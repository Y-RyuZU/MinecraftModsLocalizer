/** @type {import('next-i18next').UserConfig} */
module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja'],
    localeDetection: true,
  },
  defaultNS: 'common',
  localePath: './public/locales',
}
