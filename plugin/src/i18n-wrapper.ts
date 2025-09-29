import tinyI18n from "tiny-i18n";

const { createIsolateI18n } = tinyI18n as unknown as {
  createIsolateI18n: () => typeof tinyI18n;
};

export { createIsolateI18n };
export default tinyI18n;
