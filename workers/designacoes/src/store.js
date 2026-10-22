import { ServiceError } from "./errors.js";
import { getGoogleAccessToken } from "../../notifications-relay/src/index.js";

const encode = (v) => {
  if (v == null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === "object") return { mapValue: { fields: fields(v) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  return { stringValue: String(v) };
};
const fields = (v) =>
  Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]));
const decode = (v) => {
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("mapValue" in v) return documentData(v.mapValue);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("integerValue" in v) return Number(v.integerValue);
  return v.stringValue ?? v.booleanValue ?? v.doubleValue ?? null;
};
const documentData = (d) =>
  Object.fromEntries(
    Object.entries(d.fields || {}).map(([k, v]) => [k, decode(v)]),
  );

export function createStore(env) {
  const local = env.LOCAL_EMULATORS === "true";
  if (
    local &&
    (!env.FIREBASE_PROJECT_ID?.startsWith("demo-") ||
      !/^127\.0\.0\.1:\d+$/.test(env.FIRESTORE_EMULATOR_HOST || ""))
  )
    throw new Error("Emulação exige projeto demo e loopback.");
  const database = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)`;
  const base = `${local ? `http://${env.FIRESTORE_EMULATOR_HOST}` : "https://firestore.googleapis.com"}/v1/${database}/documents`;
  async function call(suffix, body, method = "POST") {
    const authorization = local
      ? "Bearer owner"
      : `Bearer ${await getGoogleAccessToken(env)}`;
    const response = await fetch(base + suffix, {
      method,
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 404) return null;
    const result = await response.json();
    if (!response.ok) {
      const error = new Error("Falha ao acessar os dados.");
      error.status = result.error?.status;
      throw error;
    }
    return result;
  }
  async function query(collection, filters = [], limit = 100, cursor = null) {
    const predicates = filters.map(([fieldPath, op, value]) => ({
      fieldFilter: { field: { fieldPath }, op, value: encode(value) },
    }));
    const range = filters.some(([, op]) => op === "LESS_THAN_OR_EQUAL");
    const orderBy = [
      ...(range
        ? [{ field: { fieldPath: "expiraEm" }, direction: "ASCENDING" }]
        : []),
      { field: { fieldPath: "__name__" }, direction: "ASCENDING" },
    ];
    const result = await call(":runQuery", {
      structuredQuery: {
        from: [{ collectionId: collection }],
        ...(predicates.length
          ? {
              where:
                predicates.length === 1
                  ? predicates[0]
                  : { compositeFilter: { op: "AND", filters: predicates } },
            }
          : {}),
        orderBy,
        ...(cursor
          ? {
              startAt: {
                before: false,
                values: [
                  ...(range ? [encode(cursor.expiraEm)] : []),
                  {
                    referenceValue: `${database}/documents/${collection}/${cursor.id}`,
                  },
                ],
              },
            }
          : {}),
        limit,
      },
    });
    return (result || [])
      .filter((r) => r.document)
      .map((r) => ({
        ...documentData(r.document),
        id: r.document.name.split("/").pop(),
      }));
  }
  async function list(collection, filters = []) {
    const all = [];
    let cursor = null;
    for (let i = 0; i < 100; i++) {
      const page = await query(collection, filters, 100, cursor);
      all.push(...page);
      if (page.length < 100) return all;
      cursor = page.at(-1);
    }
    throw new Error("Listagem excede o limite operacional.");
  }
  async function transaction(work) {
    let previousTransaction;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { transaction: id } = await call(":beginTransaction", {
        options: {
          readWrite: previousTransaction
            ? { retryTransaction: previousTransaction }
            : {},
        },
      });
      const writes = [];
      const read = new Map();
      const tx = {
        async get(path) {
          if (!read.has(path)) {
            const result = await call(":batchGet", {
              documents: [`${database}/documents/${path}`],
              transaction: id,
            });
            const d = result?.find((item) => item.found)?.found;
            read.set(path, d ? documentData(d) : null);
          }
          return read.get(path);
        },
        set(path, data) {
          writes.push({
            update: {
              name: `${database}/documents/${path}`,
              fields: fields(data),
            },
          });
        },
        create(path, data) {
          writes.push({
            update: {
              name: `${database}/documents/${path}`,
              fields: fields(data),
            },
            currentDocument: { exists: false },
          });
        },
        delete(path) {
          writes.push({ delete: `${database}/documents/${path}` });
        },
      };
      try {
        const result = await work(tx);
        if (writes.length) await call(":commit", { transaction: id, writes });
        else await call(":rollback", { transaction: id });
        return result;
      } catch (error) {
        await call(":rollback", { transaction: id }).catch(() => {});
        if (error.status === "ABORTED" && attempt < 3) {
          previousTransaction = id;
          const jitter = crypto.getRandomValues(new Uint32Array(1))[0] % 250;
          await new Promise((resolve) =>
            setTimeout(resolve, 30 * 2 ** attempt + jitter),
          );
          continue;
        }
        if (error.status === "ABORTED") throw new ServiceError("Os dados mudaram durante a operação. Tente novamente; o estado anterior foi preservado.", 409);
        throw error;
      }
    }
  }
  return { transaction, query, list };
}
