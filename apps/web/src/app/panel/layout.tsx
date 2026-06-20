import './panel.css'

export const metadata = {
  title: 'КРЕСТ · Панель администратора',
}

/** Корневой layout /panel — только стили. Гард в (dash)/layout. */
export default function PanelRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="panel-root">{children}</div>
}
