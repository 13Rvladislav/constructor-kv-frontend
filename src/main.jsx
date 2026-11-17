
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';

import App from './App';
import './styles.css';

const theme = {
  token: {
    colorPrimary: '#2563eb',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',

    colorBgBase: '#f5f7fa',
    colorBgContainer: '#ffffff',

    colorText: '#1e293b',
    colorTextSecondary: '#64748b',

    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#edf0f4',

    borderRadius: 8,
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

    fontSize: 13,
    controlHeight: 32,
  },

  components: {
    Layout: {
      bodyBg: '#f5f7fa',
      headerBg: '#ffffff',
      siderBg: '#ffffff',
    },

    Button: {
      fontWeight: 500,
      primaryShadow: 'none',
    },

    Table: {
      headerBg: '#f8fafc',
      headerColor: '#475569',
      rowHoverBg: '#f1f5f9',
      borderColor: '#e2e8f0',
      cellPaddingBlock: 10,
      cellPaddingInline: 12,
    },

    Tree: {
      nodeHoverBg: '#f1f5f9',
      nodeSelectedBg: '#eff6ff',
      nodeSelectedColor: '#1d4ed8',
    },

    Input: {
      activeShadow: '0 0 0 2px rgba(37, 99, 235, 0.12)',
    },

    Select: {
      optionSelectedBg: '#eff6ff',
    },
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <ConfigProvider locale={ruRU} theme={theme}>
    <App />
  </ConfigProvider>,
);
