export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: '2rem',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '640px' }}>
        <h1
          style={{
            fontSize: '3rem',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '0.5rem',
            letterSpacing: '-0.02em',
          }}
        >
          Velya
        </h1>
        <p
          style={{
            fontSize: '1.25rem',
            color: '#475569',
            marginBottom: '2rem',
            lineHeight: 1.6,
          }}
        >
          AI-Native Hospital Operations Platform
        </p>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Feature
            title="Patient Flow"
            description="Real-time visibility into patient journeys from admission to discharge"
          />
          <Feature
            title="Smart Tasks"
            description="AI-prioritized clinical task inbox with context-aware routing"
          />
          <Feature
            title="Discharge Coordination"
            description="Identify and resolve discharge blockers before they cause delays"
          />
        </div>
      </div>
    </main>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        width: '180px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'left',
      }}
    >
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: '#0f172a',
          marginTop: 0,
          marginBottom: '0.5rem',
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  );
}
