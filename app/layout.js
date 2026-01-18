import './globals.css'

export const metadata = {
  title: 'SLP Safety Analytics',
  description: 'Predictive Safety Analytics Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
