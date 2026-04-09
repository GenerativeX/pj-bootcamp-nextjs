import { SITE_METADATA } from "@/lib/constant";
import type { Metadata } from "next";
import { Provider } from "@/components/Provider";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: {
    default: SITE_METADATA.NAME,
    template: SITE_METADATA.TEMPLATE,
  },
  description: SITE_METADATA.DESCRIPTION,
  icons: {
    icon: SITE_METADATA.ICON,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <Provider>
          <Sidebar>{children}</Sidebar>
        </Provider>
      </body>
    </html>
  );
}
