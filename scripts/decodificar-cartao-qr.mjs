import { readFile,writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import jsQR from "jsqr";
const require=createRequire(`${process.env.CARTAO_NODE_MODULES}/package.json`);
const {loadImage,createCanvas}=require("@napi-rs/canvas");
let totalPages=0;
const output=process.env.CARTAO_OUTPUT_DIR || "artifacts/cartao-pdf";
for(const name of ["curto","seis","longo","paginado","unicode"]) {
 const {pages}=JSON.parse(await readFile(`${output}/${name}.json`,"utf8"));
 totalPages+=pages;
 for(let i=1;i<=pages;i++) {
 const image=await loadImage(await readFile(`${output}/${name}-${i}.png`));
 const canvas=createCanvas(image.width,image.height),ctx=canvas.getContext("2d");ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 const qr=jsQR(new Uint8ClampedArray(pixels.data),canvas.width,canvas.height);
 if(qr?.data!=="https://territ-es-sbs.web.app/#/c/cartao-ficticio") throw new Error(`QR inválido: ${name}/${i}`);
 console.log(`${name}/${i}: QR permanente decodificado, sem PIN/token`);
}
}
await writeFile(`${output}/qr-verification.json`,JSON.stringify({url:"https://territ-es-sbs.web.app/#/c/cartao-ficticio",pages:totalPages,noCredential:true},null,2));
