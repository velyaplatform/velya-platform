'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ROLES = [
  'Coordenador de Ala',
  'Medico',
  'Enfermeiro(a)',
  'Tecnico de Enfermagem',
  'Planejador de Alta',
  'Farmaceutico',
  'Fisioterapeuta',
  'Recepcao',
  'Motorista',
  'Higienizacao',
  'Faturamento',
  'Diretor Clinico',
  'Administrador',
];

const ROLES_WITH_COUNCIL = [
  'Medico',
  'Enfermeiro(a)',
  'Tecnico de Enfermagem',
  'Farmaceutico',
  'Fisioterapeuta',
  'Coordenador de Ala',
  'Diretor Clinico',
];

export default function RegisterPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('');
  const [setor, setSetor] = useState('');
  const [conselhoProfissional, setConselhoProfissional] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const showCouncil = ROLES_WITH_COUNCIL.includes(role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!nome || !email || !password || !confirmPassword || !role || !setor) {
      setError('Preencha todos os campos obrigatorios');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no minimo 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          nome,
          role,
          setor,
          conselhoProfissional: showCouncil ? conselhoProfissional : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta');
        setLoading(false);
        return;
      }

      router.push(`/verify?email=${encodeURIComponent(email)}${data.devCode ? `&devCode=${data.devCode}` : ''}`);
    } catch {
      setError('Erro de conexao. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>Velya</div>
          <div style={styles.logoSub}>Plataforma Hospitalar</div>
          <h1 style={styles.title}>Criar Conta</h1>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.field}>
            <label style={styles.label}>Nome Completo *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Dr. Carlos Silva"
              style={styles.input}
              autoComplete="name"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@hospital.com"
              style={styles.input}
              autoComplete="email"
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Senha *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
                style={styles.input}
                autoComplete="new-password"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Confirmar Senha *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                style={styles.input}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Profissao / Funcao *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={styles.select}
            >
              <option value="">Selecione sua funcao</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Setor / Unidade *</label>
            <input
              type="text"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              placeholder="Ex: UTI Adulto, Ala 2B, Pronto Atendimento"
              style={styles.input}
            />
          </div>

          {showCouncil && (
            <div style={styles.field}>
              <label style={styles.label}>Registro Profissional</label>
              <input
                type="text"
                value={conselhoProfissional}
                onChange={(e) => setConselhoProfissional(e.target.value)}
                placeholder="Ex: CRM-SP 12345, COREN-RJ 67890"
                style={styles.input}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>

          <div style={styles.footer}>
            <span style={styles.footerText}>Ja tem conta? </span>
            <Link href="/login" style={styles.link}>Entrar</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
  },
  card: {
    background: '#1e293b',
    borderRadius: '16px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '520px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '2rem',
  },
  logo: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.02em',
  },
  logoSub: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginTop: '2px',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.9)',
    marginTop: '1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
    flex: 1,
  },
  row: {
    display: 'flex',
    gap: '1rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.6)',
  },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    color: '#ffffff',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
  },
  select: {
    background: '#1e293b',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    color: '#ffffff',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    width: '100%',
  },
  button: {
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.75rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    marginTop: '0.5rem',
  },
  error: {
    background: 'rgba(220,38,38,0.15)',
    border: '1px solid rgba(220,38,38,0.3)',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    color: '#fca5a5',
    fontSize: '0.85rem',
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '0.5rem',
  },
  footerText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.85rem',
  },
  link: {
    color: '#60a5fa',
    fontSize: '0.85rem',
    textDecoration: 'none',
    fontWeight: 500,
  },
};
