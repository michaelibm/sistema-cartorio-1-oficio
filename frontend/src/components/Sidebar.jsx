import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';


function Sidebar({ usuario, onLogout, onToggle }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Comunica ao componente pai quando o estado muda
  useEffect(() => {
    if (onToggle) {
      onToggle(isCollapsed);
    }
  }, [isCollapsed, onToggle]);

  // Define itens do menu com permissões
  const menuItems = [
    { path: '/', icon: '📊', label: 'Dashboard', color: '#3b82f6', roles: ['Supervisor', 'Coordenador', 'Registrador'] },
    { path: '/protocolos', icon: '📋', label: 'Protocolos', color: '#8b5cf6', roles: ['Supervisor', 'Coordenador', 'Registrador'] },
    { path: '/fila', icon: '📥', label: 'Fila de Atendimento', color: '#f59e0b', roles: ['Supervisor', 'Coordenador', 'Registrador'] },
    { path: '/', icon: '🎫', label: 'Balcão de Atendimento', color: '#f59e0b', roles: ['Atendente'] },
    { path: '/servicos', icon: '⚙️', label: 'Tipos de Serviço', color: '#10b981', roles: ['Supervisor', 'Coordenador'] },
    { path: '/usucapiao', icon: '🏡', label: 'Usucapião', color: '#6366f1', roles: ['Supervisor', 'Coordenador', 'Registrador'] },
    { path: '/minha-produtividade', icon: '⚡', label: 'Minha Produtividade', color: '#f59e0b', roles: ['Registrador'] },
    { path: '/historico', icon: '📜', label: 'Histórico', color: '#10b981', roles: ['Supervisor', 'Coordenador', 'Registrador'] },
    { path: '/relatorios', icon: '📈', label: 'Relatórios', color: '#06b6d4', roles: ['Supervisor', 'Coordenador'] },
    { path: '/funcionarios', icon: '👥', label: 'Funcionários', color: '#f59e0b', roles: ['Supervisor'] },
    { path: '/configuracoes', icon: '🔧', label: 'Configurações', color: '#ec4899', roles: ['Supervisor'] },
  ];

  // Filtra itens baseado no cargo do usuário
  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(usuario?.cargo || 'Supervisor')
  );

  const isActive = (path) => location.pathname === path;

  return (
    <div style={{
      width: isCollapsed ? '80px' : '280px',
      height: '100vh',
      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      boxShadow: '2px 0 16px rgba(0, 0, 0, 0.06)',
      zIndex: 1000,
      borderRight: '1px solid #e2e8f0',
      transition: 'width 0.3s ease'
    }}>
      {/* Logo/Header */}
      <div style={{
        padding: isCollapsed ? '1.5rem 0.75rem' : '2rem 1.5rem 1.5rem',
        borderBottom: '1px solid #e2e8f0',
        position: 'relative'
      }}>
        {/* Botão de Recolher */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            position: 'absolute',
            right: '-12px',
            top: '2rem',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'white',
            border: '2px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span style={{
            fontSize: '0.75rem',
            transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }}>
            ◀
          </span>
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '0.5rem',
          justifyContent: 'center'
        }}>
          <h1 style={{
            fontSize: isCollapsed ? '1rem' : '1.375rem',
            fontWeight: '700',
            color: '#1e293b',
            margin: 0,
            lineHeight: 1.2,
            transition: 'font-size 0.3s ease'
          }}>
            {isCollapsed ? 'Á5' : 'Águia 5.0'}
          </h1>
        </div>
      </div>

      {/* Menu Items */}
      <nav style={{
        flex: 1,
        padding: isCollapsed ? '1rem 0.5rem' : '1.5rem 1rem',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {!isCollapsed && (
          <div style={{
            fontSize: '0.7rem',
            fontWeight: '700',
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0 0.75rem',
            marginBottom: '1rem',
            opacity: isCollapsed ? 0 : 1,
            transition: 'opacity 0.3s ease'
          }}>
            NAVEGAÇÃO
          </div>
        )}

        {filteredMenuItems.map((item) => {
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              title={isCollapsed ? item.label : ''}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: '0.875rem',
                padding: isCollapsed ? '0.875rem' : '0.875rem 1rem',
                marginBottom: '0.375rem',
                borderRadius: '12px',
                textDecoration: 'none',
                color: active ? '#1e293b' : '#64748b',
                background: active ? '#f1f5f9' : 'transparent',
                border: active ? '1px solid #e2e8f0' : '1px solid transparent',
                transition: 'all 0.2s ease',
                fontWeight: active ? '600' : '500',
                fontSize: '0.9375rem',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#334155';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }
              }}
            >
              <span style={{
                fontSize: '1.375rem',
                lineHeight: 1,
                opacity: active ? 1 : 0.85
              }}>
                {item.icon}
              </span>
              
              {!isCollapsed && (
                <>
                  <span style={{ 
                    flex: 1,
                    opacity: isCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease'
                  }}>
                    {item.label}
                  </span>

                  {active && (
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: item.color,
                      boxShadow: `0 0 8px ${item.color}80`
                    }} />
                  )}
                </>
              )}

              {/* Indicador quando recolhido */}
              {isCollapsed && active && (
                <div style={{
                  position: 'absolute',
                  left: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '4px',
                  height: '24px',
                  borderRadius: '2px',
                  background: item.color,
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div style={{
        padding: isCollapsed ? '1rem 0.75rem' : '1.5rem',
        borderTop: '1px solid #e2e8f0',
        background: '#fafbfc'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.875rem',
          marginBottom: '1rem',
          justifyContent: isCollapsed ? 'center' : 'flex-start'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg,rgb(119, 118, 116) 0%,rgb(17, 49, 177) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.125rem',
            fontWeight: '700',
            color: 'white',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
            flexShrink: 0
          }}>
            {usuario?.nome?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          
          {!isCollapsed && (
            <div style={{ 
              flex: 1, 
              minWidth: 0,
              opacity: isCollapsed ? 0 : 1,
              transition: 'opacity 0.3s ease'
            }}>
              <div style={{
                fontSize: '0.9375rem',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '0.25rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {usuario?.nome || 'Administrador'}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b',
                fontWeight: '500'
              }}>
                {usuario?.cargo || 'Supervisor'}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onLogout}
          title={isCollapsed ? 'Sair' : ''}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            background: 'linear-gradient(135deg,rgb(101, 99, 99) 0%,rgb(26, 53, 186) 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '0.9375rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.25)';
          }}
        >
          <span style={{ fontSize: '1.125rem' }}></span>
          {!isCollapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
