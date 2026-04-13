import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Overview from './pages/Overview'
import { fetchProducts } from './api/client'
import type { Product } from './types/signals'
import { MOCK_PRODUCTS } from './api/mockData'

function Sidebar() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setProducts(MOCK_PRODUCTS))
  }, [])

  return (
    <nav
      style={{
        width: 200,
        flexShrink: 0,
        background: 'var(--color-background-primary)',
        borderRight: '0.5px solid var(--color-border-tertiary)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '16px 16px 14px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          OpenClaw
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
          Amazon Ops AI
        </div>
      </div>

      {/* Nav links */}
      <div style={{ padding: '10px 8px' }}>
        <NavLink
          to="/"
          end
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 'var(--border-radius-md)',
            fontSize: 13,
            color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            background: isActive ? 'var(--color-background-secondary)' : 'transparent',
            textDecoration: 'none',
            fontWeight: isActive ? 500 : 400,
            marginBottom: 2,
          })}
        >
          <span>📋</span>
          <span>产品概览</span>
        </NavLink>
      </div>

      {/* Products list */}
      {products.length > 0 && (
        <div style={{ padding: '0 8px' }}>
          <div
            style={{
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '8px 8px 4px',
            }}
          >
            产品
          </div>
          {products.map((product) => (
            <NavLink
              key={product.asin}
              to={`/product/${product.asin}`}
              style={({ isActive }) => ({
                display: 'block',
                padding: '6px 8px',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 12,
                color: isActive
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
                background: isActive ? 'var(--color-background-secondary)' : 'transparent',
                textDecoration: 'none',
                marginBottom: 2,
              })}
            >
              <div
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 400,
                }}
              >
                {product.name}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-mono)',
                  marginTop: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {product.asin}
                {(product.signal_count_p0 ?? 0) > 0 && (
                  <span
                    style={{
                      background: '#FCEBEB',
                      color: '#A32D2D',
                      borderRadius: 99,
                      padding: '1px 5px',
                      fontSize: 9,
                    }}
                  >
                    P0
                  </span>
                )}
              </div>
            </NavLink>
          ))}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: 'auto',
          padding: '12px 16px',
          borderTop: '0.5px solid var(--color-border-tertiary)',
          fontSize: 10,
          color: 'var(--color-text-tertiary)',
        }}
      >
        v1.0.0
      </div>
    </nav>
  )
}

function AppLayout() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--color-background-primary)',
      }}
    >
      <Sidebar />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          padding: '0 2rem',
          maxWidth: 1100,
        }}
      >
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/product/:asin" element={<Dashboard />} />
          <Route
            path="*"
            element={
              <div
                style={{
                  padding: '3rem',
                  textAlign: 'center',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                页面不存在
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
