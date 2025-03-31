import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Preload fonts with crossOrigin attribute to fix CORS issues */}
        <link
          rel="preload"
          href="/_next/static/media/gyByhwUxId8gMEwcGFWNOITd-s.p.da1ebef7.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/_next/static/media/or3nQ6H_1_WfwkMZI_qYFrcdmhHkjko-s.p.be19f591.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
