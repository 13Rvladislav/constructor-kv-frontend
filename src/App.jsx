
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Button,
  Empty,
  Input,
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
} from '@ant-design/icons';

import { treeApi, kvApi } from './api/client';

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

function getStatusColor(status) {
  if (!status) return 'default';

  return STATUS_COLORS[String(status).toUpperCase()] || 'default';
}

function getStatusLabel(status) {
  if (!status) return 'Не указан';

  const labels = {
    NEW: 'Новая',
    CREATED: 'Создана',
    IN_PROGRESS: 'В работе',
    AGREED: 'Согласована',
    APPROVED: 'Утверждена',
    CANCELLED: 'Отменена',
    REJECTED: 'Отклонена',
  };

  return labels[String(status).toUpperCase()] || status;
}

/**
 * Формирование дерева:
 *
 * Тема
 *   └── Изделие
 *         └── Группа
 *
 * Важно:
 * ID группы может повторяться у разных изделий.
 * Поэтому ключ группы должен включать ID темы и изделия.
 */
function getTreeData(temas, searchValue = '') {
  const normalizedSearch = searchValue
    .trim()
    .toLocaleLowerCase('ru-RU');

  return (temas || [])
    .map((tema) => {
      const izdelia = (tema.izdelia || [])
        .map((izdelie) => {
          const designation = String(izdelie.name || '').trim();
          const description = String(izdelie.fullName || '').trim();

          const productLabel = [
            designation,
            description,
          ]
            .filter(Boolean)
            .join(' — ') || `Изделие ${izdelie.id}`;

          const productMatches =
            !normalizedSearch ||
            productLabel
              .toLocaleLowerCase('ru-RU')
              .includes(normalizedSearch) ||
            String(izdelie.id).includes(normalizedSearch);

          const groupes = (izdelie.groupes || [])
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
                izdelieName: productLabel,
                groupeName: groupe.name,
              },
            }))
            .filter((groupe) => {
              if (!normalizedSearch || productMatches) {
                return true;
              }

              return String(groupe.title)
                .toLocaleLowerCase('ru-RU')
                .includes(normalizedSearch);
            });

          if (!productMatches && groupes.length === 0) {
            return null;
          }

          return {
            title: (
              <span className="tree-product-title">
                <Text strong>
                  {designation || `Изделие ${izdelie.id}`}
                </Text>

                {description && (
                  <Text type="secondary">
                    {' — '}
                    {description}
                  </Text>
                )}
              </span>
            ),

            key: `product-${tema.id}-${izdelie.id}`,

            icon: <AppstoreOutlined />,

            children: groupes,

            nodeType: 'product',
          };
        })
        .filter(Boolean);

      const temaMatches =
        !normalizedSearch ||
        String(tema.name || '')
          .toLocaleLowerCase('ru-RU')
          .includes(normalizedSearch) ||
        String(tema.indeksKd ?? '')
          .includes(normalizedSearch);

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

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('ru-RU');
}

function renderValue(value) {
  return value === null || value === undefined || value === ''
    ? '—'
    : value;
}

/**
 * Отображение элемента сборочной структуры PDM.
 */
function AssemblyNode({ node }) {
  const hasChildren = node.children?.length > 0;

  return (
    <div className="assembly-node">
      <div className="assembly-node-main">
        <div className="assembly-node-info">
          <Text className="assembly-node-design">
            {renderValue(node.obozn)}
          </Text>

          <Text className="assembly-node-name">
            {renderValue(node.naim)}
          </Text>
        </div>

        <div className="assembly-node-meta">
          <Text type="secondary">
            Кол-во: {renderValue(node.quantity)}
          </Text>

          {node.massa !== null && node.massa !== undefined && (
            <Text type="secondary">
              Масса: {node.massa}
            </Text>
          )}

          {node.level !== null && node.level !== undefined && (
            <Tag bordered={false}>
              Уровень {node.level}
            </Tag>
          )}
        </div>
      </div>

      {node.material && (
        <div className="assembly-node-extra">
          <Text type="secondary">
            Материал: {node.material}
          </Text>
        </div>
      )}

      {node.note && (
        <div className="assembly-node-extra">
          <Text type="secondary">
            Примечание: {node.note}
          </Text>
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
            <Text type="secondary">
              {node.fitReason}
            </Text>
          )}
        </div>
      )}

      {node.series?.length > 0 && (
        <div className="assembly-series">
          <Text type="secondary">
            Серии:
          </Text>

          {node.series.map((series, index) => (
            <Tag key={`${node.id}-series-${index}`}>
              {series.mini ?? '—'} – {series.maxi ?? '—'}
            </Tag>
          ))}
        </div>
      )}

      {hasChildren && (
        <div className="assembly-node-children">
          {node.children.map((child, index) => (
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

export default function App() {
  const [messageApi, contextHolder] = message.useMessage();

  // Дерево PDM
  const [treeData, setTreeData] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeSearch, setTreeSearch] = useState('');

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState([]);

  // Таблица КВ
  const [tableData, setTableData] = useState([]);
  const [groupInfo, setGroupInfo] = useState(null);
  const [tableLoading, setTableLoading] = useState(false);

  const [selectedRow, setSelectedRow] = useState(null);

  // Состав PDM
  const [assemblyData, setAssemblyData] = useState([]);
  const [assemblyLoading, setAssemblyLoading] = useState(false);

  const [globalError, setGlobalError] = useState(null);

  const filteredTree = useMemo(
    () => getTreeData(treeData, treeSearch),
    [treeData, treeSearch],
  );

  const treeStatistics = useMemo(() => {
    const temas = treeData.length;

    let izdelia = 0;
    let groupes = 0;

    treeData.forEach((tema) => {
      const products = tema.izdelia || [];

      izdelia += products.length;

      products.forEach((product) => {
        groupes += (product.groupes || []).length;
      });
    });

    return {
      temas,
      izdelia,
      groupes,
    };
  }, [treeData]);

  /**
   * Загрузка дерева PDM.
   */
  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    setGlobalError(null);

    try {
      const response = await treeApi.getFullTree();

      const temas = Array.isArray(response?.temas)
        ? response.temas
        : [];

      setTreeData(temas);

      if (temas.length > 0) {
        setExpandedKeys([`tema-${temas[0].id}`]);
      }
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
   * Загрузка таблицы комплектовок выбранной группы.
   */
  const loadTable = useCallback(
    async (group) => {
      if (!group) return;

      setTableLoading(true);

      setTableData([]);
      setGroupInfo(null);
      setSelectedRow(null);
      setAssemblyData([]);

      try {
        const response = await kvApi.getTable(group);

        setTableData(
          Array.isArray(response?.rows)
            ? response.rows
            : [],
        );

        setGroupInfo(response?.groupInfo || null);
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

  /**
   * Загрузка состава спецификации PDM.
   */
  const loadAssemblyPreview = useCallback(
    async (row) => {
      if (!row?.specifId) {
        setAssemblyData([]);

        messageApi.warning(
          'Для выбранной записи отсутствует идентификатор спецификации',
        );

        return;
      }

      setAssemblyLoading(true);
      setAssemblyData([]);

      try {
        const response = await kvApi.getAssemblyPreview(row.specifId);

        setAssemblyData(
          Array.isArray(response)
            ? response
            : [],
        );
      } catch (error) {
        messageApi.error(
          error?.message || 'Не удалось загрузить состав из PDM',
        );
      } finally {
        setAssemblyLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  /**
   * Обработка выбора узла дерева.
   */
  const handleTreeSelect = (keys, info) => {
    if (!keys.length) return;

    const node = info.node;

    if (node.nodeType !== 'group') {
      return;
    }

    const group = node.data;

    setSelectedGroup(group);

    loadTable(group);
  };

  /**
   * Выбор строки таблицы.
   */
  const handleRowSelect = (record) => {
    setSelectedRow(record);
    setAssemblyData([]);
  };

  /**
   * Открытие предпросмотра PDM.
   */
  const handleOpenPreview = () => {
    if (!selectedRow) {
      messageApi.warning('Сначала выбери запись в таблице');
      return;
    }

    loadAssemblyPreview(selectedRow);
  };

  /**
   * Уникальный ключ строки таблицы.
   *
   * Один ID служебной записки может встречаться
   * с несколькими ID спецификаций.
   */
  const getTableRowKey = (record) => {
    return [
      record.slZapiskaId ?? 'no-sl',
      record.specifId ?? 'no-specif',
      record.komplektovkaId ?? 'no-kv',
      record.number ?? 'no-number',
    ].join('-');
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
      render: renderValue,
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
          <Text type="secondary">
            Не сформирована
          </Text>
        ),
    },
    {
      title: 'Родительская КВ',
      dataIndex: 'parentKvDesign',
      key: 'parentKvDesign',
      width: 160,
      ellipsis: true,
      render: renderValue,
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
          <Tag color="default">Нет</Tag>
        ),
    },
    {
      title: 'КВ',
      dataIndex: 'hasKv',
      key: 'hasKv',
      width: 75,
      align: 'center',
      render: (value) =>
        value ? (
          <Tag color="success">Есть</Tag>
        ) : (
          <Tag color="default">Нет</Tag>
        ),
    },
  ];

  const selectedGroupTitle = groupInfo
    ? [
        groupInfo.temaName,
        groupInfo.izdelieName,
        `Группа ${groupInfo.groupeId}`,
      ]
        .filter(Boolean)
        .join(' / ')
    : selectedGroup
      ? [
          selectedGroup.temaName,
          selectedGroup.izdelieName,
          selectedGroup.groupeName || `Группа ${selectedGroup.groupeId}`,
        ]
          .filter(Boolean)
          .join(' / ')
      : 'Группа не выбрана';

  const selectedTreeKeys = selectedGroup
    ? [
        `group-${selectedGroup.temaId}-${selectedGroup.izdelieId}-${selectedGroup.groupeId}`,
      ]
    : [];

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
        {/* Левая панель: дерево */}
        <section className="panel tree-panel">
          <div className="panel-header">
            <div>
              <Title level={5}>
                Структура изделий
              </Title>

              <Text type="secondary">
                Темы, изделия и группы
              </Text>
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
                  selectedKeys={selectedTreeKeys}
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
            <Text type="secondary">
              Тем: {treeStatistics.temas}
            </Text>

            <Text type="secondary">
              Изделий: {treeStatistics.izdelia}
            </Text>

            <Text type="secondary">
              Групп: {treeStatistics.groupes}
            </Text>
          </div>
        </section>

        {/* Центральная панель: таблица */}
        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <Title level={5}>
                Комплектовки и служебные записки
              </Title>

              <Text type="secondary">
                {selectedGroupTitle}
              </Text>
            </div>

            <div className="panel-header-actions">
              <Button
                icon={<FileSearchOutlined />}
                type="primary"
                disabled={!selectedRow}
                onClick={handleOpenPreview}
                loading={assemblyLoading}
              >
                Состав PDM
              </Button>
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
                  pageSize: 20,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50', '100'],
                  showTotal: (total) => `Всего записей: ${total}`,
                }}
                scroll={{ x: 1100 }}
                rowSelection={{
                  type: 'radio',

                  selectedRowKeys: selectedRow
                    ? [getTableRowKey(selectedRow)]
                    : [],

                  onChange: (_, rows) => {
                    handleRowSelect(rows[0] || null);
                  },
                }}
                onRow={(record) => ({
                  onDoubleClick: () => {
                    handleRowSelect(record);
                    loadAssemblyPreview(record);
                  },

                  onClick: () => handleRowSelect(record),
                })}
                locale={{
                  emptyText: 'В выбранной группе нет записей',
                }}
              />
            )}
          </div>

          <div className="panel-footer table-footer">
            <Text type="secondary">
              Записей: {tableData.length}
            </Text>

            {selectedRow && (
              <Text type="secondary">
                Выбрана запись № {renderValue(selectedRow.number)}
              </Text>
            )}
          </div>
        </section>

        {/* Правая панель: состав */}
        <section className="panel assembly-panel">
          <div className="panel-header">
            <div>
              <Title level={5}>
                Состав КВ
              </Title>

              <Text type="secondary">
                Предпросмотр исходной структуры PDM
              </Text>
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

                <Text type="secondary">
                  Загрузка состава из PDM...
                </Text>
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
                  onClick={handleOpenPreview}
                >
                  Загрузить состав PDM
                </Button>
              </Empty>
            )}
          </div>

          <div className="panel-footer assembly-footer">
            <Text type="secondary">
              {assemblyData.length > 0
                ? `Корневых элементов: ${assemblyData.length}`
                : 'Ожидание данных'}
            </Text>
          </div>
        </section>
      </main>

      <footer className="workflow-placeholder">
        <div>
          <Text strong>
            Маршрут проработки
          </Text>

          <Text type="secondary">
            Данные маршрута появятся после реализации соответствующего API
          </Text>
        </div>

        <Tag>
          Не реализовано
        </Tag>
      </footer>
    </div>
  );
}
