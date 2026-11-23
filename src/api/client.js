
import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8091/api';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ======================================================
// ERROR NORMALIZATION
// ======================================================

function normalizeApiError(error) {
  if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
    return {
      status: null,
      code: 'ERR_CANCELED',
      canceled: true,
      message: 'Запрос отменён',
      data: null,
      originalError: error,
    };
  }

  if (error.response) {
    const status = error.response.status;

    const message =
      error.response.data?.message ||
      error.response.data?.detail ||
      error.response.data?.error ||
      `Ошибка сервера: HTTP ${status}`;

    return {
      status,
      code: error.code || null,
      canceled: false,
      message,
      data: error.response.data,
      originalError: error,
    };
  }

  if (error.request) {
    return {
      status: null,
      code: error.code || null,
      canceled: false,
      message:
        error.code === 'ECONNABORTED'
          ? 'Превышено время ожидания ответа сервера'
          : 'Сервер недоступен. Проверь подключение к backend.',
      data: null,
      originalError: error,
    };
  }

  return {
    status: null,
    code: error.code || null,
    canceled: false,
    message: error.message || 'Неизвестная ошибка',
    data: null,
    originalError: error,
  };
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeApiError(error)),
);

// ======================================================
// TREE API
// ======================================================

export const treeApi = {
  /**
   * Получить полное дерево:
   * Тема -> Изделие -> Группа
   *
   * GET /api/tree/full
   */
  getFullTree: async () => {
    const response = await apiClient.get('/tree/full');
    return response.data;
  },

  /**
   * Получить дерево конкретной темы.
   *
   * GET /api/tree/tema/{temaId}
   */
  getTreeByTemaId: async (temaId) => {
    const response = await apiClient.get(`/tree/tema/${temaId}`);
    return response.data;
  },

  /**
   * Получить информацию о теме.
   *
   * GET /api/tree/tema/{temaId}/info
   */
  getTemaInfo: async (temaId) => {
    const response = await apiClient.get(`/tree/tema/${temaId}/info`);
    return response.data;
  },

  /**
   * Поиск тем.
   *
   * GET /api/tree/search?query=
   */
  searchTemas: async (query) => {
    const response = await apiClient.get('/tree/search', {
      params: { query },
    });

    return response.data;
  },
};

// ======================================================
// KV API
// ======================================================

export const kvApi = {
  /**
   * Получить таблицу комплектовок.
   *
   * GET /api/kvtable
   */
  getTable: async ({ temaId, izdelieId, groupeId }) => {
    const response = await apiClient.get('/kvtable', {
      params: {
        temaId,
        izdelieId,
        groupeId,
      },
    });

    return response.data;
  },

  /**
   * Получить предпросмотр исходной сборки из PDM.
   *
   * GET /api/kv/preview/assembly?specifId=
   */
  getAssemblyPreview: async (specifId) => {
    const response = await apiClient.get('/kv/preview/assembly', {
      params: { specifId },
    });

    return response.data;
  },

  /**
   * Получить полную структуру спецификации
   * вместе с сериями каждой позиции.
   *
   * GET /api/kv/specification-structure?specifId=
   */
  getSpecificationStructure: async (specifId) => {
    const response = await apiClient.get('/kv/specification-structure', {
      params: { specifId },
    });

    return response.data;
  },

  /**
   * Сформировать комплектовку.
   *
   * POST /api/kv/form
   */
  form: async ({ slZapiskaId, specifId, formedBy }) => {
    const response = await apiClient.post('/kv/form', {
      slZapiskaId,
      specifId,
      formedBy,
    });

    return response.data;
  },
};

export default apiClient;
