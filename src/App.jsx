
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Empty,
  Input,
  Select,
  Spin,
  Table,
  Tag,
  Tree,
  Typography,
  message,
} from 'antd';

import {
  AppstoreOutlined,
  BranchesOutlined,
  FileSearchOutlined,
  FolderOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  UndoOutlined,
  LeftOutlined,
  RightOutlined,
  ExpandOutlined,
  CompressOutlined,
} from '@ant-design/icons';

import { treeApi, kvApi } from './api/client';
import AssemblyPreviewModal from './components/AssemblyPreviewModal';
import SpecificationStructureModal from './components/SpecificationStructureModal';
import AssemblyStructureTable from './components/AssemblyStructureTable';
import './styles/panel-collapse.css';

const { Text, Title } = Typography;

const STATUS_COLORS = {
  NEW: 'blue',
  CREATED: 'blue',
  IN_PROGRESS: 'processing',
  AGREED: 'success',
  APPROVED: 'success',
  CANCELLED: 'error',
  REJECTED: 'error',
};

const STATUS_LABELS = {
  NEW: 'Новая',
  CREATED: 'Создана',
  IN_PROGRESS: 'В работе',
  AGREED: 'Согласована',
  APPROVED: 'Утверждена',
  CANCELLED: 'Отменена',
  REJECTED: 'Отклонена',
};

const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

const valueOrDash = (value) =>
  value === null || value === undefined || value === '' ? '—' : value;

function getTableRowKey(record, index = 0) {
  if (record?.number !== null && record?.number !== undefined) {
    return `row-${record.number}`;
  }

  return [
    'row',
    record?.slZapiskaId ?? 'no-sl',
    record?.specifId ?? 'no-spec',
    record?.komplektovkaId ?? 'no-kv',
    index,
  ].join('-');
}

function getStatusColor(status) {
  if (!status) return 'default';
  return STATUS_COLORS[String(status).toUpperCase()] || 'default';
}

function getStatusLabel(status) {
  if (!status) return 'Не указан';

  const normalized = String(status).toUpperCase();
  return STATUS_LABELS[normalized] || status;
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('ru-RU');
}

function getTreeData(temas, searchValue = '') {
  const search = searchValue.trim().toLowerCase();

  return (temas || [])
    .map((tema) => {
      const izdelia = (tema.izdelia || [])
        .map((izdelie) => {
          const groupes = (izdelie.groupes || [])
            .filter((groupe) => {
              if (!search) return true;

              return String(groupe.name || '')
                .toLowerCase()
                .includes(search);
            })
            .map((groupe) => ({
              title: groupe.name || `Группа ${groupe.id}`,
              key: `group-${tema.id}-${izdelie.id}-${groupe.id}`,
              icon: <FolderOutlined />,
              isLeaf: true,
              nodeType: 'group',
              data: {
                temaId: tema.id,
                izdelieId: izdelie.id,
                groupeId: groupe.id,
                temaName: tema.name,
                izdelieName: izdelie.fullName || izdelie.name,
                groupeName: groupe.name,
              },
            }));

          const designation = String(izdelie.name || '');
          const fullName = String(izdelie.fullName || '');

          const matches =
            !search ||
            designation.toLowerCase().includes(search) ||
            fullName.toLowerCase().includes(search);

          if (!matches && groupes.length === 0) {
            return null;
          }

          return {
            title: (
              <div className="tree-product-title">
                <span className="tree-product-designation">
                  {designation || `Изделие ${izdelie.id}`}
                </span>

                {fullName && fullName !== designation && (
                  <span className="tree-product-name">{fullName}</span>
                )}
              </div>
            ),
            key: `product-${tema.id}-${izdelie.id}`,
            icon: <AppstoreOutlined />,
            children: groupes,
            nodeType: 'product',
          };
        })
        .filter(Boolean);

      const temaMatches =
        !search ||
        String(tema.name || '').toLowerCase().includes(search);

      if (!temaMatches && izdelia.length === 0) {
        return null;
      }

      return {
        title: tema.name || `Тема ${tema.id}`,
        key: `tema-${tema.id}`,
        icon: <BranchesOutlined />,
        children: izdelia,
        nodeType: 'tema',
      };
    })
    .filter(Boolean);
}

function countAssemblyNodes(nodes = []) {
  return nodes.reduce(
    (total, node) =>
      total + 1 + countAssemblyNodes(node.children || []),
    0,
  );
}

function normalizeStatusOptions(serverOptions) {
  const source = Array.isArray(serverOptions) ? serverOptions : [];
  const unique = new Map();

  source.forEach((item) => {
    const value =
      typeof item === 'object' && item !== null
        ? item.value ?? item.status ?? item.code
        : item;

    if (value === null || value === undefined || value === '') {
      return;
    }

    const label =
      typeof item === 'object' && item !== null
        ? item.label ?? getStatusLabel(value)
        : getStatusLabel(value);

    unique.set(String(value), {
      value: String(value),
      label,
    });
  });

  return [
    { value: 'ALL', label: 'Все статусы' },
    ...Array.from(unique.values()),
  ];
}

export default function App() {
  const [messageApi, contextHolder] = message.useMessage();

  const [treeData, setTreeData] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeSearch, setTreeSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const [tableData, setTableData] = useState([]);
  const [groupInfo, setGroupInfo] = useState(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [serverStatusOptions, setServerStatusOptions] = useState([]);

  const [tableSearch, setTableSearch] = useState('');
  const [debouncedTableSearch, setDebouncedTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [kvFilter, setKvFilter] = useState('ALL');

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalRows, setTotalRows] = useState(0);

  const [assemblyData, setAssemblyData] = useState([]);
  const [assemblyLoading, setAssemblyLoading] = useState(false);
  const [assemblySpecifId, setAssemblySpecifId] = useState(null);
  const [assemblyLoadingSpecifId, setAssemblyLoadingSpecifId] = useState(null);

  const assemblyRequestRef = useRef(0);
  const tableRequestRef = useRef(0);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [specificationOpen, setSpecificationOpen] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  // Управление шириной рабочих панелей.
  const [collapsedPanels, setCollapsedPanels] = useState({
    tree: false,
    table: false,
  });
  const [assemblyFocus, setAssemblyFocus] = useState(false);

  const togglePanel = (panel) => {
    setCollapsedPanels((previous) => ({
      ...previous,
      [panel]: !previous[panel],
    }));
    setAssemblyFocus(false);
  };

  const toggleAssemblyFocus = () => {
    setAssemblyFocus((previous) => !previous);
    setCollapsedPanels({ tree: false, table: false });
  };

  const filteredTree = useMemo(
    () => getTreeData(treeData, treeSearch),
    [treeData, treeSearch],
  );

  const statusOptions = useMemo(
    () => normalizeStatusOptions(serverStatusOptions),
    [serverStatusOptions],
  );

  const selectedTreeKey = selectedGroup
    ? `group-${selectedGroup.temaId}-${selectedGroup.izdelieId}-${selectedGroup.groupeId}`
    : null;

  const selectedGroupTitle = groupInfo
    ? [
      groupInfo.temaName || selectedGroup?.temaName,
      groupInfo.izdelieName || selectedGroup?.izdelieName,
      groupInfo.groupeId
        ? `Группа ${groupInfo.groupeId}`
        : selectedGroup?.groupeName,
    ]
      .filter(Boolean)
      .join(' / ')
    : selectedGroup
      ? [
        selectedGroup.temaName,
        selectedGroup.izdelieName,
        selectedGroup.groupeName ||
        `Группа ${selectedGroup.groupeId}`,
      ]
        .filter(Boolean)
        .join(' / ')
      : 'Группа не выбрана';

  const clearSelectedRow = useCallback(() => {
    setSelectedRow(null);

    assemblyRequestRef.current += 1;
    setAssemblyData([]);
    setAssemblySpecifId(null);
    setAssemblyLoadingSpecifId(null);
    setAssemblyLoading(false);
  }, []);

  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    setGlobalError(null);

    try {
      const response = await treeApi.getFullTree();
      const temas = response?.temas || [];

      setTreeData(temas);
      setExpandedKeys([]);
    } catch (error) {
      const errorMessage =
        error?.message || 'Не удалось загрузить дерево изделий';

      setGlobalError(errorMessage);
      messageApi.error(errorMessage);
    } finally {
      setTreeLoading(false);
    }
  }, [messageApi]);

  /**
   * Загрузка таблицы.
   *
   * Все фильтры и параметры пагинации передаются на backend.
   * Здесь больше нет локальной фильтрации полученных строк.
   */
  const loadTable = useCallback(
    async (group, query, options = {}) => {
      if (!group) return;

      const requestId = ++tableRequestRef.current;

      setTableLoading(true);

      try {
        const response = await kvApi.getTable({
          temaId: group.temaId,
          izdelieId: group.izdelieId,
          groupeId: group.groupeId,
          search: query.search,
          status: query.status,
          hasKv: query.hasKv,
          page: query.page,
          size: query.size,
        });

        if (requestId !== tableRequestRef.current) {
          return;
        }

        const rows = Array.isArray(response?.rows)
          ? response.rows
          : [];

        setTableData(rows);
        setGroupInfo(response?.groupInfo || null);
        setTotalRows(Number(response?.totalRows ?? rows.length));

        setServerStatusOptions(
          Array.isArray(response?.statusOptions)
            ? response.statusOptions
            : [],
        );

        if (options.keepSelection && options.selectedRow) {
          const refreshedRow = rows.find(
            (row) =>
              String(row.slZapiskaId) ===
              String(options.selectedRow.slZapiskaId) &&
              String(row.specifId) ===
              String(options.selectedRow.specifId),
          );

          if (refreshedRow) {
            setSelectedRow(refreshedRow);
          } else {
            clearSelectedRow();
          }
        }
      } catch (error) {
        if (requestId === tableRequestRef.current) {
          messageApi.error(
            error?.message || 'Не удалось загрузить таблицу комплектовок',
          );
        }
      } finally {
        if (requestId === tableRequestRef.current) {
          setTableLoading(false);
        }
      }
    },
    [clearSelectedRow, messageApi],
  );

  /**
   * Задержка поиска, чтобы не отправлять запрос на каждый символ.
   */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedTableSearch(tableSearch.trim());
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [tableSearch]);

  /**
   * Автоматическая загрузка таблицы при изменении:
   * - выбранной группы;
   * - поисковой строки;
   * - статуса;
   * - наличия КВ;
   * - страницы;
   * - размера страницы.
   */
  useEffect(() => {
    if (!selectedGroup) return;

    const query = {
      search: debouncedTableSearch,
      status: statusFilter,
      hasKv:
        kvFilter === 'HAS_KV'
          ? true
          : kvFilter === 'NO_KV'
            ? false
            : undefined,
      page,
      size: pageSize,
    };

    loadTable(selectedGroup, query);
  }, [
    selectedGroup,
    debouncedTableSearch,
    statusFilter,
    kvFilter,
    page,
    pageSize,
    loadTable,
  ]);

  const loadAssemblyPreview = useCallback(
    async (row) => {
      if (!row?.specifId) {
        setAssemblyData([]);
        setAssemblySpecifId(null);

        messageApi.warning(
          'Для выбранной записи отсутствует идентификатор спецификации',
        );

        return false;
      }

      const requestId = ++assemblyRequestRef.current;
      const specifId = row.specifId;

      setAssemblyLoading(true);
      setAssemblyLoadingSpecifId(specifId);
      setAssemblySpecifId(null);
      setAssemblyData([]);

      try {
        const response = await kvApi.getAssemblyPreview(specifId);

        const nodes = Array.isArray(response)
          ? response
          : response?.items || response?.elements || [];

        if (requestId !== assemblyRequestRef.current) {
          return false;
        }

        setAssemblyData(nodes);
        setAssemblySpecifId(specifId);

        return true;
      } catch (error) {
        if (requestId === assemblyRequestRef.current) {
          messageApi.error(
            error?.message || 'Не удалось загрузить состав из PDM',
          );
        }

        return false;
      } finally {
        if (requestId === assemblyRequestRef.current) {
          setAssemblyLoading(false);
          setAssemblyLoadingSpecifId(null);
        }
      }
    },
    [messageApi],
  );

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const handleTreeSelect = (keys, info) => {
    if (!keys.length) return;

    const node = info.node;

    if (node.nodeType !== 'group') {
      return;
    }

    const nextGroup = node.data;

    setSelectedGroup(nextGroup);

    setTableSearch('');
    setDebouncedTableSearch('');
    setStatusFilter('ALL');
    setKvFilter('ALL');
    setPage(0);
    setPageSize(20);

    setTableData([]);
    setGroupInfo(null);
    setTotalRows(0);
    setServerStatusOptions([]);

    clearSelectedRow();
  };

  const handleRowSelect = (record) => {
    setSelectedRow(record || null);

    if (!record) {
      clearSelectedRow();
      return;
    }

    if (
      record.specifId &&
      String(assemblySpecifId) !== String(record.specifId) &&
      String(assemblyLoadingSpecifId) !== String(record.specifId)
    ) {
      loadAssemblyPreview(record);
    } else if (!record.specifId) {
      clearSelectedRow();

      messageApi.warning(
        'Для выбранной записи отсутствует идентификатор спецификации',
      );
    }
  };

  const handleOpenPreview = async (row = null) => {
    const targetRow = row || selectedRow;

    if (!targetRow) {
      messageApi.warning('Сначала выбери запись в таблице');
      return;
    }

    setSelectedRow(targetRow);
    setPreviewOpen(true);

    if (
      !targetRow.specifId ||
      (String(assemblySpecifId) !== String(targetRow.specifId) &&
        String(assemblyLoadingSpecifId) !== String(targetRow.specifId))
    ) {
      await loadAssemblyPreview(targetRow);
    }
  };

  const handleOpenSpecification = () => {
    if (!selectedRow) {
      messageApi.warning('Сначала выбери запись в таблице');
      return;
    }

    if (!selectedRow.specifId) {
      messageApi.warning(
        'Для выбранной записи отсутствует идентификатор спецификации',
      );
      return;
    }

    setSpecificationOpen(true);
  };

  const handleCloseSpecification = () => {
    setSpecificationOpen(false);
  };

  const handleClosePreview = () => {
    if (formLoading) return;
    setPreviewOpen(false);
  };

  const handleFormKv = async () => {
    if (!selectedRow) {
      messageApi.warning('Не выбрана запись для формирования КВ');
      return;
    }

    if (!selectedRow.slZapiskaId || !selectedRow.specifId) {
      messageApi.error(
        'Для формирования КВ необходимы slZapiskaId и specifId',
      );
      return;
    }

    if (selectedRow.hasKv || selectedRow.komplektovkaId) {
      messageApi.warning('Для этой записи КВ уже сформирована');
      return;
    }

    if (assemblyLoading || assemblyData.length === 0) {
      messageApi.warning('Сначала дождись загрузки состава спецификации');
      return;
    }

    setFormLoading(true);

    try {
      await kvApi.form({
        slZapiskaId: selectedRow.slZapiskaId,
        specifId: selectedRow.specifId,
      });

      messageApi.success('Комплектовочная ведомость сформирована');
      setPreviewOpen(false);

      const currentSelectedRow = selectedRow;

      await loadTable(
        selectedGroup,
        {
          search: debouncedTableSearch,
          status: statusFilter,
          hasKv:
            kvFilter === 'HAS_KV'
              ? true
              : kvFilter === 'NO_KV'
                ? false
                : undefined,
          page,
          size: pageSize,
        },
        {
          keepSelection: true,
          selectedRow: currentSelectedRow,
        },
      );
    } catch (error) {
      messageApi.error(
        error?.message || 'Не удалось сформировать комплектовочную ведомость',
      );
    } finally {
      setFormLoading(false);
    }
  };

  const resetTableFilters = () => {
    setTableSearch('');
    setDebouncedTableSearch('');
    setStatusFilter('ALL');
    setKvFilter('ALL');
    setPage(0);

    clearSelectedRow();
  };

  const handleTableSearchChange = (event) => {
    setTableSearch(event.target.value);
    setPage(0);
    clearSelectedRow();
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setPage(0);
    clearSelectedRow();
  };

  const handleKvFilterChange = (value) => {
    setKvFilter(value);
    setPage(0);
    clearSelectedRow();
  };

  const handleTablePaginationChange = (nextPage, nextPageSize) => {
    clearSelectedRow();

    if (nextPageSize !== pageSize) {
      setPageSize(nextPageSize);
      setPage(0);
      return;
    }

    setPage(nextPage - 1);
  };

  
const columns = [
   {
    title: 'Служебная записка',
    dataIndex: 'slZapiskaObozn',
    key: 'slZapiskaObozn',
    width: 115,
    ellipsis: true,
    render: valueOrDash,
  },
  {
    title: 'Обозначение КВ',
    dataIndex: 'komplektovkaDesign',
    key: 'komplektovkaDesign',
    width: 135,
    ellipsis: true,
    render: (value) =>
      value ? (
        <Text strong>{value}</Text>
      ) : (
        <Text type="secondary">Не сформирована</Text>
      ),
  },
  {
    title: 'Дата',
    dataIndex: 'slZapAgreedDate',
    key: 'slZapAgreedDate',
    width: 82,
    ellipsis: true,
    render: formatDate,
  },
  {
    title: 'Статус',
    dataIndex: 'status',
    key: 'status',
    width: 85,
    render: (status) => (
      <Tag color={getStatusColor(status)}>
        {getStatusLabel(status)}
      </Tag>
    ),
  },
];


  const selectedRowIndex = selectedRow
    ? tableData.findIndex(
      (row) =>
        String(row.slZapiskaId) === String(selectedRow.slZapiskaId) &&
        String(row.specifId) === String(selectedRow.specifId) &&
        String(row.number) === String(selectedRow.number),
    )
    : -1;

  const selectedRowKey =
    selectedRow && selectedRowIndex >= 0
      ? getTableRowKey(selectedRow, selectedRowIndex)
      : null;

  const canFormKv = Boolean(
    selectedRow &&
    !selectedRow.hasKv &&
    !selectedRow.komplektovkaId &&
    selectedRow.slZapiskaId &&
    selectedRow.specifId,
  );

  const assemblyCount = countAssemblyNodes(assemblyData);

  return (
    <div className="app">
      {contextHolder}

      <header className="app-header">
        <div className="app-header-brand">
          <div className="app-logo">
            <BranchesOutlined />
          </div>

          <div>
            <Title level={4} className="app-title">
              Конструктор КВ
            </Title>

            <Text type="secondary" className="app-subtitle">
              Система управления комплектовками
            </Text>
          </div>
        </div>

        <div className="app-header-actions">
          <Button
            icon={<ReloadOutlined />}
            onClick={loadTree}
            loading={treeLoading}
          >
            Обновить
          </Button>
        </div>
      </header>

      {globalError && (
        <Alert
          className="global-error"
          type="error"
          showIcon
          message={globalError}
          action={
            <Button size="small" onClick={loadTree}>
              Повторить
            </Button>
          }
        />
      )}

      <main
        className={[
          'workspace',
          collapsedPanels.tree ? 'tree-panel-collapsed' : '',
          collapsedPanels.table ? 'table-panel-collapsed' : '',
          assemblyFocus ? 'assembly-focus-mode' : '',
        ].filter(Boolean).join(' ')}
      >
        <section className="panel tree-panel">
          <div className="panel-header">
            <div>
              <Title level={5}>Структура изделий</Title>
              <Text type="secondary">Темы, изделия и группы</Text>
            </div>

            <Button
              className="panel-collapse-button"
              type="text"
              size="small"
              title={collapsedPanels.tree ? 'Развернуть панель' : 'Свернуть панель'}
              aria-label={collapsedPanels.tree ? 'Развернуть панель структуры' : 'Свернуть панель структуры'}
              icon={collapsedPanels.tree ? <RightOutlined /> : <LeftOutlined />}
              onClick={() => togglePanel('tree')}
            />
          </div>

          <div className="panel-search">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Поиск по дереву..."
              value={treeSearch}
              onChange={(event) => setTreeSearch(event.target.value)}
            />
          </div>

          <div className="tree-content">
            <Spin spinning={treeLoading}>
              {filteredTree.length > 0 ? (
                <Tree
                  showIcon
                  blockNode
                  treeData={filteredTree}
                  expandedKeys={expandedKeys}
                  onExpand={setExpandedKeys}
                  onSelect={handleTreeSelect}
                  selectedKeys={selectedTreeKey ? [selectedTreeKey] : []}
                />
              ) : (
                !treeLoading && (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Данные не найдены"
                  />
                )
              )}
            </Spin>
          </div>

          <div className="panel-footer">
            <Text type="secondary">Тем: {treeData.length}</Text>

            <Text type="secondary">
              Изделий:{' '}
              {treeData.reduce(
                (sum, tema) => sum + (tema.izdelia?.length || 0),
                0,
              )}
            </Text>
          </div>
        </section>

        <section className="panel table-panel">
          <div className="panel-header table-panel-header">
            <div className="table-panel-heading">
              <Title level={5}>
                Комплектовки и служебные записки
              </Title>

              <Text type="secondary">{selectedGroupTitle}</Text>
            </div>

            <div className="panel-header-actions">
              <Button
                icon={<FileSearchOutlined />}
                disabled={!selectedRow || !selectedRow.specifId}
                onClick={handleOpenSpecification}
              >
                Просмотреть спецификацию
              </Button>

              <Button
                icon={<FileSearchOutlined />}
                type="primary"
                disabled={!selectedRow}
                onClick={() => handleOpenPreview()}
              >
                Предпросмотр
              </Button>

              <Button
                className="panel-collapse-button"
                type="text"
                size="small"
                title={collapsedPanels.table ? 'Развернуть панель' : 'Свернуть панель'}
                aria-label={collapsedPanels.table ? 'Развернуть панель комплектовок' : 'Свернуть панель комплектовок'}
                icon={collapsedPanels.table ? <LeftOutlined /> : <RightOutlined />}
                onClick={() => togglePanel('table')}
              />
            </div>
          </div>

          <div className="table-filter-toolbar">
            <Input
              className="table-search-input"
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Поиск по №, СЗ, КВ, спецификации..."
              value={tableSearch}
              onChange={handleTableSearchChange}
              disabled={!selectedGroup || tableLoading}
            />

            <div className="table-filter-controls">
              <Select
                className="table-filter-select"
                value={statusFilter}
                onChange={handleStatusChange}
                disabled={!selectedGroup || tableLoading}
                options={statusOptions}
                placeholder="Все статусы"
                popupMatchSelectWidth={false}
              />

              <Select
                className="table-filter-select table-kv-filter"
                value={kvFilter}
                onChange={handleKvFilterChange}
                disabled={!selectedGroup || tableLoading}
                options={[
                  { value: 'ALL', label: 'Все записи' },
                  { value: 'HAS_KV', label: 'С комплектовкой' },
                  { value: 'NO_KV', label: 'Без комплектовки' },
                ]}
                popupMatchSelectWidth={false}
              />

              <Button
                className="table-reset-button"
                onClick={resetTableFilters}
                disabled={
                  !tableSearch &&
                  statusFilter === 'ALL' &&
                  kvFilter === 'ALL'
                }
              >
                Сбросить
              </Button>
            </div>
          </div>

          <div className="table-action-toolbar">
            <div className="table-secondary-actions">
              <Button
                className="table-danger-action"
                danger
                icon={<StopOutlined />}
                disabled
                title="Backend-операция пока не подключена"
              >
                Аннулировать КВ
              </Button>

              <Button
                className="table-neutral-action"
                icon={<UndoOutlined />}
                disabled
                title="Backend-операция пока не подключена"
              >
                Отменить декомпозицию
              </Button>
            </div>

            <div className="table-selected-label">
              {selectedRow ? (
                <>
                  <span className="table-selected-dot" />
                  Выбрана запись № {valueOrDash(selectedRow.number)}
                </>
              ) : (
                'Запись не выбрана'
              )}
            </div>
          </div>

          <div className="table-content">
            {!selectedGroup ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Выбери группу в дереве слева"
              />
            ) : (
              <Table
                rowKey={getTableRowKey}
                columns={columns}
                dataSource={tableData}
                loading={tableLoading}
                size="small"
                bordered
                pagination={{
                  current: page + 1,
                  pageSize,
                  total: totalRows,
                  showSizeChanger: true,
                  pageSizeOptions: PAGE_SIZE_OPTIONS,
                  showTotal: (total, range) =>
                    `${range[0]}–${range[1]} из ${total}`,
                  onChange: handleTablePaginationChange,
                }}
               tableLayout="fixed"
                rowSelection={{
                  type: 'radio',
                  selectedRowKeys: selectedRowKey ? [selectedRowKey] : [],
                  onChange: (_, rows) => {
                    handleRowSelect(rows[0] || null);
                  },
                }}
                onRow={(record) => ({
                  onClick: () => handleRowSelect(record),
                  onDoubleClick: () => handleOpenPreview(record),
                })}
                locale={{
                  emptyText: 'В выбранной группе нет записей',
                }}
              />
            )}
          </div>

          <div className="panel-footer table-footer">
            <Text type="secondary">
              На странице: {tableData.length}. Всего: {totalRows}
            </Text>

            {selectedRow && (
              <Text type="secondary">
                Выбрана запись № {valueOrDash(selectedRow.number)}
              </Text>
            )}
          </div>
        </section>

        <section className="panel assembly-panel">
          <div className="panel-header">
            <div>
              <Title level={5}>Состав спецификации</Title>
              <Text type="secondary">Исходная структура PDM</Text>
            </div>

            <div className="panel-header-actions">
              <Button
                type="text"
                size="small"
                title={assemblyFocus ? 'Вернуть обычный режим' : 'Развернуть состав на всю ширину'}
                aria-label={assemblyFocus ? 'Вернуть обычный режим панелей' : 'Развернуть состав на всю ширину'}
                icon={assemblyFocus ? <CompressOutlined /> : <ExpandOutlined />}
                onClick={toggleAssemblyFocus}
              />

              <Button
                size="small"
                icon={<ReloadOutlined />}
                disabled={!selectedRow}
                loading={assemblyLoading}
                onClick={() => loadAssemblyPreview(selectedRow)}
              />
            </div>
          </div>

          <div className="assembly-content">
            {!selectedRow ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Выбери запись в таблице"
              />
            ) : assemblyLoading ? (
              <div className="assembly-loading">
                <Spin />
                <Text type="secondary">Загрузка состава из PDM...</Text>
              </div>
            ) : assemblyData.length > 0 ? (
              <AssemblyStructureTable
                data={assemblyData}
                loading={assemblyLoading}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Состав не загружен"
              >
                <Button
                  type="primary"
                  icon={<FileSearchOutlined />}
                  onClick={() => loadAssemblyPreview(selectedRow)}
                >
                  Загрузить состав
                </Button>
              </Empty>
            )}
          </div>

          <div className="panel-footer assembly-footer">
            <Text type="secondary">
              {assemblyData.length > 0
                ? `Элементов в составе: ${assemblyCount}`
                : 'Ожидание данных'}
            </Text>
          </div>
        </section>
      </main>

      <footer className="workflow-placeholder">
        <div>
          <Text strong>Маршрут проработки</Text>
          <Text type="secondary">
            Данные маршрута появятся после реализации соответствующего API
          </Text>
        </div>

        <Tag>Не реализовано</Tag>
      </footer>

      <SpecificationStructureModal
        open={specificationOpen}
        onClose={handleCloseSpecification}
        specifId={selectedRow?.specifId}
      />

      <AssemblyPreviewModal
        open={previewOpen}
        onCancel={handleClosePreview}
        onConfirm={handleFormKv}
        onRefresh={() => loadAssemblyPreview(selectedRow)}
        loading={assemblyLoading}
        confirming={formLoading}
        data={assemblyData}
        selectedRow={selectedRow}
        canConfirm={canFormKv}
      />
    </div>
  );
}
