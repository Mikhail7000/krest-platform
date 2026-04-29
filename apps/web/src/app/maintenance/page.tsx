export const dynamic = 'force-dynamic'

export default function MaintenancePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0e1116',
        color: '#e6e6e6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '32px 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✝️</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#C9A961', marginBottom: 14 }}>
          Приложение в разработке
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#b8b8b8', marginBottom: 10 }}>
          Извините, мы сейчас обновляем платформу.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#b8b8b8' }}>
          Попробуйте зайти позже — скоро будет всё готово.
        </p>
        <div style={{ marginTop: 28, fontSize: 12, color: '#6b6b6b', letterSpacing: 0.4 }}>
          КРЕСТ · maintenance mode
        </div>
      </div>
    </div>
  )
}
