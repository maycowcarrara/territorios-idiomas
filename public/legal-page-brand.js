(() => {
  const fallbackAppName = 'Territórios';

  const setAppName = (appName) => {
    const safeName = appName || fallbackAppName;
    document.querySelectorAll('[data-app-name]').forEach((element) => {
      element.textContent = safeName;
    });

    const pageTitle = document.body?.dataset?.pageTitle;
    if (pageTitle) {
      document.title = `${pageTitle} | ${safeName}`;
    }
  };

  setAppName(fallbackAppName);

  fetch('/manifest.webmanifest', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((manifest) => {
      const appName = manifest?.name || manifest?.short_name;
      if (appName) setAppName(appName);
    })
    .catch(() => {
      setAppName(fallbackAppName);
    });
})();
