
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
} from '@ant-design/icons';

import { treeApi, kvApi } from './api/client';
import AssemblyPreviewModal from './components/AssemblyPreviewModal';
import SpecificationStructureModal from './components/SpecificationStructureModal';

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

function AssemblyNode({ node }) {
  const children = node.children || [];

  return (
    <div className="assembly-node">
      <div className="assembly-node-main">
        <div className="assembly-node-info">
          <Text className="assembly-node-design">
            {valueOrDash(node.obozn)}
          </Text>

          <Text className="assembly-node-name">
            {valueOrDash(node.naim)}
          </Text>
        </div>

        <div className="assembly-node-meta">
          <Text type="secondary">
            Кол-во: {valueOrDash(node.quantity)}
          </Text>

          {node.massa !== null && node.massa !== undefined && (
            <Text type="secondary">
              Масса: {node.massa}
            </Text>
          )}

          {node.level !== null && node.level !== undefined && (
            <Tag bordered={false}>Уровень {node.level}</Tag>
          )}
        </div>
      </div>

      {(node.material || node.note) && (
        <div className="assembly-node-extra">
          {node.material && (
            <Text type="secondary">Материал: {node.material}</Text>
          )}

          {node.note && (
            <Text type="secondary">Примечание: {node.note}</Text>
          )}
        </div>
      )}

      {node.fitsSeries !== null && node.fitsSeries !== undefined && (
        <div className="assembly-node-extra">
          <Tag color={node.fitsSeries ? 'success' : 'warning'}>
            {node.fitsSeries
              ? 'Соответствует серии'
              : 'Не соответствует серии'}
          </Tag>

          {node.fitReason && (
            <Text type="secondary">{node.fitReason}</Text>
          )}
        </div>
      )}

      {node.series?.length > 0 && (
        <div className="assembly-series">
          <Text type="secondary">Серии:</Text>

          {node.series.map((series, index) => (
            <Tag key={`${node.id}-series-${index}`}>
              {valueOrDash(series.mini)} – {valueOrDash(series.maxi)}
            </Tag>
          ))}
        </div>
      )}

      {children.length > 0 && (
        <div className="assembly-node-children">
          {children.map((child, index) => (
            <AssemblyNode
              key={child.id ?? `${node.id}-${index}`}
              node={child}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function normalizeStatusOptions(serverOptions, rows) {
  const source =
    Array.isArray(serverOptions) && serverOptions.length > 0
      ? serverOptions
      : rows
          .map((row) => row.status)
          .filter(
            (status) =>
              status !== null &&
              status !== undefined &&
              status !== '',
          );

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
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [kvFilter, setKvFilter] = useState('ALL');

  const [assemblyData, setAssemblyData] = useState([]);
  const [assemblyLoading, setAssemblyLoading] = useState(false);
  const [assemblySpecifId, setAssemblySpecifId] = useState(null);
  const [assemblyLoadingSpecifId, setAssemblyLoadingSpecifId] = useState(null);

  const assemblyRequestRef = useRef(0);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [specificationOpen, setSpecificationOpen] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  const filteredTree = useMemo(
    () => getTreeData(treeData, treeSearch),
    [treeData, treeSearch],
  );

  const selectedTreeKey = selectedGroup
    ? `group-${selectedGroup.temaId}-${selectedGroup.izdelieId}-${selectedGroup.groupeId}`
    : null;

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

  const loadTable = useCallback(
    async (group, options = {}) => {
      if (!group) return;

      setTableLoading(true);
      setTableData([]);
      setGroupInfo(null);
      setServerStatusOptions([]);
      setSelectedRow(null);

      setTableSearch('');
      setStatusFilter('ALL');
      setKvFilter('ALL');

      setAssemblyData([]);
      setAssemblySpecifId(null);
      setAssemblyLoadingSpecifId(null);

      assemblyRequestRef.current += 1;
      setAssemblyLoading(false);

      try {
        const response = await kvApi.getTable(group);

        const rows = Array.isArray(response?.rows)
          ? response.rows
          : [];

        setTableData(rows);
        setGroupInfo(response?.groupInfo || null);

        setServerStatusOptions(
          Array.isArray(response?.statusOptions)
            ? response.statusOptions
            : [],
        );

        if (options.keepSelection && options.selectedSlZapiskaId) {
          const refreshedRow = rows.find(
            (row) =>
              String(row.slZapiskaId) ===
              String(options.selectedSlZapiskaId),
          );

          if (refreshedRow) {
            setSelectedRow(refreshedRow);
          }
        }
      } catch (error) {
        messageApi.error(
          error?.message || 'Не удалось загрузить таблицу комплектовок',
        );
      } finally {
        setTableLoading(false);
      }
    },
    [messageApi],
  );

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

    setSelectedGroup(node.data);
    loadTable(node.data);
  };

  const handleRowSelect = (record) => {
    setSelectedRow(record || null);

    if (!record) {
      assemblyRequestRef.current += 1;

      setAssemblyData([]);
      setAssemblySpecifId(null);
      setAssemblyLoadingSpecifId(null);
      setAssemblyLoading(false);

      return;
    }

    if (
      record.specifId &&
      String(assemblySpecifId) !== String(record.specifId) &&
      String(assemblyLoadingSpecifId) !== String(record.specifId)
    ) {
      loadAssemblyPreview(record);
    } else if (!record.specifId) {
      assemblyRequestRef.current += 1;

      setAssemblyData([]);
      setAssemblySpecifId(null);
      setAssemblyLoadingSpecifId(null);
      setAssemblyLoading(false);

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

      await loadTable(selectedGroup, {
        keepSelection: true,
        selectedSlZapiskaId: selectedRow.slZapiskaId,
      });
    } catch (error) {
      messageApi.error(
        error?.message || 'Не удалось сформировать комплектовочную ведомость',
      );
    } finally {
      setFormLoading(false);
    }
  };

  const statusOptions = useMemo(
    () => normalizeStatusOptions(serverStatusOptions, tableData),
    [serverStatusOptions, tableData],
  );

  const filteredTableData = useMemo(() => {
    const normalizedSearch = tableSearch
      .trim()
      .toLocaleLowerCase('ru-RU');

    return tableData.filter((row) => {
      const searchableValues = [
        row.number,
        row.slZapiskaId,
        row.slZapiskaObozn,
        row.komplektovkaId,
        row.komplektovkaDesign,
        row.parentKvDesign,
        row.specifId,
      ];

      const matchesSearch =
        !normalizedSearch ||
        searchableValues.some((value) =>
          String(value ?? '')
            .toLocaleLowerCase('ru-RU')
            .includes(normalizedSearch),
        );

      const matchesStatus =
        statusFilter === 'ALL' ||
        String(row.status) === statusFilter;

      const hasKv = Boolean(row.hasKv || row.komplektovkaId);

      const matchesKv =
        kvFilter === 'ALL' ||
        (kvFilter === 'HAS_KV' && hasKv) ||
        (kvFilter === 'NO_KV' && !hasKv);

      return matchesSearch && matchesStatus && matchesKv;
    });
  }, [tableData, tableSearch, statusFilter, kvFilter]);

  const resetTableFilters = () => {
    setTableSearch('');
    setStatusFilter('ALL');
    setKvFilter('ALL');
  };

  const columns = [
    {
      title: '№',
      dataIndex: 'number',
      key: 'number',
      width: 55,
      align: 'center',
    },
    {
      title: 'Служебная записка',
      dataIndex: 'slZapiskaObozn',
      key: 'slZapiskaObozn',
      width: 180,
      ellipsis: true,
      render: valueOrDash,
    },
    {
      title: 'Обозначение КВ',
      dataIndex: 'komplektovkaDesign',
      key: 'komplektovkaDesign',
      width: 180,
      ellipsis: true,
      render: (value) =>
        value ? (
          <Text strong>{value}</Text>
        ) : (
          <Text type="secondary">Не сформирована</Text>
        ),
    },
    {
      title: 'Родительская КВ',
      dataIndex: 'parentKvDesign',
      key: 'parentKvDesign',
      width: 160,
      ellipsis: true,
      render: valueOrDash,
    },
    {
      title: 'Дата согласования',
      dataIndex: 'slZapAgreedDate',
      key: 'slZapAgreedDate',
      width: 145,
      render: formatDate,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: 'Согласование СЗ',
      dataIndex: 'isSlZapAgreed',
      key: 'isSlZapAgreed',
      width: 135,
      align: 'center',
      render: (value) =>
        value ? (
          <Tag color="success">Да</Tag>
        ) : (
          <Tag>Нет</Tag>
        ),
    },
    {
      title: 'КВ',
      dataIndex: 'hasKv',
      key: 'hasKv',
      width: 75,
      align: 'center',
      render: (value, record) =>
        value || record.komplektovkaId ? (
          <Tag color="success">Есть</Tag>
        ) : (
          <Tag>Нет</Tag>
        ),
    },
  ];

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

  const selectedRowIndex = selectedRow
    ? filteredTableData.findIndex(
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

      <main className="workspace">
        <section className="panel tree-panel">
          <div className="panel-header">
            <div>
              <Title level={5}>Структура изделий</Title>
              <Text type="secondary">Темы, изделия и группы</Text>
            </div>
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
            </div>
          </div>

          <div className="table-filter-toolbar">
            <Input
              className="table-search-input"
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Поиск по №, СЗ, КВ, спецификации..."
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              disabled={!selectedGroup || tableLoading}
            />

            <div className="table-filter-controls">
              <Select
                className="table-filter-select"
                value={statusFilter}
                onChange={setStatusFilter}
                disabled={!selectedGroup || tableLoading}
                options={statusOptions}
                placeholder="Все статусы"
                popupMatchSelectWidth={false}
              />

              <Select
                className="table-filter-select table-kv-filter"
                value={kvFilter}
                onChange={setKvFilter}
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
                dataSource={filteredTableData}
                loading={tableLoading}
                size="small"
                bordered
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50', '100'],
                  showTotal: (total) => `Всего записей: ${total}`,
                }}
                scroll={{ x: 1100 }}
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
              Показано: {filteredTableData.length} из {tableData.length}
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

            <Button
              size="small"
              icon={<ReloadOutlined />}
              disabled={!selectedRow}
              loading={assemblyLoading}
              onClick={() => loadAssemblyPreview(selectedRow)}
            />
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
              <div className="assembly-tree">
                {assemblyData.map((node, index) => (
                  <AssemblyNode
                    key={node.id ?? `${node.idSpecif}-${index}`}
                    node={node}
                  />
                ))}
              </div>
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
