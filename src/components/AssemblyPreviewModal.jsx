import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Divider,
  Empty,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckCircleFilled,
  DownSquareOutlined,
  ExpandAltOutlined,
  ReloadOutlined,
  TableOutlined,
} from '@ant-design/icons';

import '../styles/assembly-preview.css';

const { Text, Title } = Typography;

const TYPE_CONFIG = {
  SB: { label: 'СБОРКА', color: 'purple', group: 'assembly' },
  СБ: { label: 'СБОРКА', color: 'purple', group: 'assembly' },
  DET: { label: 'ДЕТАЛЬ', color: 'green', group: 'detail' },
  ДЕТ: { label: 'ДЕТАЛЬ', color: 'green', group: 'detail' },
  ST: { label: 'СТАНДАРТНОЕ', color: 'orange', group: 'standard' },
  СТ: { label: 'СТАНДАРТНОЕ', color: 'orange', group: 'standard' },
  POK: { label: 'ПОКУПНОЕ', color: 'magenta', group: 'purchased' },
  ПОК: { label: 'ПОКУПНОЕ', color: 'magenta', group: 'purchased' },
  MAT: { label: 'МАТЕРИАЛ', color: 'cyan', group: 'material' },
  МАТ: { label: 'МАТЕРИАЛ', color: 'cyan', group: 'material' },
};

const DIVISION_GROUPS = [
  {
    key: 'documentation',
    title: 'Документация',
    order: 0,
    match: ['документац', 'чертеж', 'чертёж'],
    color: 'blue',
  },
  {
    key: 'assembly',
    title: 'Сборочные единицы',
    order: 1,
    match: ['сбор', 'узел', 'агрегат'],
    color: 'purple',
  },
  {
    key: 'standard',
    title: 'Стандартные изделия',
    order: 2,
    match: ['стандарт'],
    color: 'orange',
  },
  {
    key: 'material',
    title: 'Материалы',
    order: 3,
    match: ['материал'],
    color: 'cyan',
  },
  {
    key: 'detail',
    title: 'Детали',
    order: 4,
    match: ['детал'],
    color: 'green',
  },
  {
    key: 'purchased',
    title: 'Покупные изделия',
    order: 5,
    match: ['покуп'],
    color: 'magenta',
  },
];

const UNKNOWN_GROUP = {
  key: 'other',
  title: 'Прочие элементы',
  order: 99,
  match: [],
  color: 'default',
};

function valueOrDash(value) {
  return value === null || value === undefined || value === ''
    ? '—'
    : value;
}

function getRawType(node) {
  return String(
    node?.elementType ??
    node?.type ??
    node?.kind ??
    node?.tip ??
    node?.typeCode ??
    '',
  ).trim().toUpperCase();
}

/**
 * Тип в первую очередь определяется по divisionName, который приходит из PDM.
 * Числовой ID используется только для известного корневого ID_DIVISION = 3.
 */
function getNodeType(node) {
  const divisionName = String(node?.divisionName ?? '').trim();

  if (divisionName) {
    const normalized = divisionName.toLowerCase();
    const group = DIVISION_GROUPS.find((item) =>
      item.match.some((word) => normalized.includes(word)),
    );

    if (group) {
      const configured = Object.values(TYPE_CONFIG).find(
        (item) => item.group === group.key,
      );

      return {
        label: group.key === 'assembly'
          ? 'СБОРКА'
          : group.key === 'standard'
            ? 'СТАНДАРТНОЕ'
            : group.key === 'purchased'
              ? 'ПОКУПНОЕ'
              : group.key === 'material'
                ? 'МАТЕРИАЛ'
                : group.key === 'detail'
                  ? 'ДЕТАЛЬ'
                  : divisionName.toUpperCase(),
        color: configured?.color || group.color,
        group: group.key,
        divisionName,
      };
    }

    return {
      label: divisionName.toUpperCase(),
      color: 'default',
      group: 'other',
      divisionName,
    };
  }

  const rawType = getRawType(node);
  if (TYPE_CONFIG[rawType]) {
    return {
      ...TYPE_CONFIG[rawType],
      divisionName: '',
    };
  }

  if (Number(node?.idDivision) === 3) {
    return {
      label: 'СБОРКА',
      color: 'purple',
      group: 'assembly',
      divisionName: '',
    };
  }

  return {
    label: 'НЕ ОПРЕДЕЛЁН',
    color: 'default',
    group: 'other',
    divisionName: '',
  };
}

function getDivisionGroup(node) {
  const type = getNodeType(node);
  const group = DIVISION_GROUPS.find((item) => item.key === type.group);

  if (group) return group;

  return {
    ...UNKNOWN_GROUP,
    title: type.divisionName || 'Прочие элементы',
  };
}

function isAssembly(node) {
  return getNodeType(node).group === 'assembly';
}

function getNodeKey(node, parentKey, index) {
  return String(
    node?.structureId ??
    node?.id ??
    `${parentKey || 'root'}-${index}`,
  );
}

function prepareTree(nodes = [], parentKey = 'root') {
  return nodes.map((node, index) => {
    const key = getNodeKey(node, parentKey, index);
    const assembly = isAssembly(node);

    return {
      ...node,
      key,
      _isAssembly: assembly,
      _type: getNodeType(node),
      _divisionGroup: getDivisionGroup(node),
      children: assembly && Array.isArray(node.children)
        ? prepareTree(node.children, key)
        : [],
    };
  });
}

function collectAllNodes(nodes = []) {
  const result = [];

  const visit = (items) => {
    items.forEach((node) => {
      result.push(node);

      if (node._isAssembly && node.children?.length) {
        visit(node.children);
      }
    });
  };

  visit(nodes);
  return result;
}

function collectExpandableKeys(nodes = []) {
  const result = [];

  const visit = (items) => {
    items.forEach((node) => {
      if (node._isAssembly && node.children?.length) {
        result.push(node.key);
        visit(node.children);
      }
    });
  };

  visit(nodes);
  return result;
}

function groupNodes(nodes = []) {
  const groups = new Map();

  nodes.forEach((node) => {
    const division = node._divisionGroup || getDivisionGroup(node);

    if (!groups.has(division.key)) {
      groups.set(division.key, {
        ...division,
        nodes: [],
      });
    }

    groups.get(division.key).nodes.push(node);
  });

  return [...groups.values()].sort((a, b) => a.order - b.order);
}

function buildGroupedRows(nodes = []) {
  const rows = [];

  groupNodes(nodes).forEach((group) => {
    rows.push({
      key: `group-${group.key}-${rows.length}`,
      _isGroup: true,
      _group: group,
      _groupCount: group.nodes.length,
    });

    group.nodes.forEach((node) => rows.push(node));
  });

  return rows;
}

function getSeriesLabel(series) {
  if (series === null || series === undefined) return '—';
  if (typeof series !== 'object') return String(series);

  const mini = series.mini ?? series.min ?? series.from;
  const maxi = series.maxi ?? series.max ?? series.to;
  const quantity = series.quantity ?? series.count;
  const massa = series.massa ?? series.mass;

  if (mini !== undefined || maxi !== undefined) {
    return `${valueOrDash(mini)}–${valueOrDash(maxi)}${
      quantity !== undefined ? ` × ${quantity}` : ''
    }${
      massa !== undefined ? ` · ${Number(massa).toFixed(2)} кг` : ''
    }`;
  }

  return (
    series.name ??
    series.design ??
    series.obozn ??
    series.value ??
    'Серия'
  );
}

function SeriesList({ series }) {
  if (!Array.isArray(series) || series.length === 0) {
    return (
      <Text type="secondary" className="preview-no-series">
        нет серий
      </Text>
    );
  }

  return (
    <div className="preview-series-list">
      {series.map((item, index) => {
        const label = getSeriesLabel(item);
        const status =
          typeof item === 'object' && item !== null
            ? item.fitsSeries
            : undefined;

        return (
          <Tag
            key={`${label}-${index}`}
            color={
              status === true
                ? 'success'
                : status === false
                  ? 'error'
                  : undefined
            }
            className="preview-series-tag"
          >
            {label}
          </Tag>
        );
      })}
    </div>
  );
}

function getNodeStatus(node) {
  if (node.fitsSeries === true) return 'success';
  if (node.fitsSeries === false) return 'error';
  return 'default';
}

function StatusIndicator({ status }) {
  const title = status === 'success'
    ? 'Подходит'
    : status === 'error'
      ? 'Не подходит'
      : 'Нет проверки';

  return (
    <Tooltip title={title}>
      <span className={`preview-status-dot preview-status-${status}`} />
    </Tooltip>
  );
}

function ElementTypeTag({ node }) {
  const type = node._type || getNodeType(node);

  return (
    <Tag
      color={type.color}
      bordered={false}
      className="preview-type-tag"
    >
      {type.label}
    </Tag>
  );
}

function formatMass(value) {
  if (value === null || value === undefined || value === '') return '—';

  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : value;
}

function createColumns() {
  return [
    {
      title: 'Обозначение',
      dataIndex: 'obozn',
      key: 'obozn',
      width: 175,
      render: (value, node) => {
        if (node._isGroup) {
          return {
            children: (
              <div className="preview-group-heading">
                <span className={`preview-group-marker preview-group-${node._group.key}`} />
                <span>{node._group.title}</span>
                <span className="preview-group-count">{node._groupCount}</span>
              </div>
            ),
            props: { colSpan: 8 },
          };
        }

        return (
          <div className="preview-design-cell">
            <span className={`preview-node-icon ${node._isAssembly ? 'preview-node-icon-assembly' : ''}`}>
              {node._isAssembly ? '▣' : '⚙'}
            </span>
            <Text className="preview-design">
              {valueOrDash(value)}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Наименование',
      dataIndex: 'naim',
      key: 'naim',
      width: 210,
      render: (value, node) => node._isGroup ? { children: null, props: { colSpan: 0 } } : (
        <Text className="preview-name">{valueOrDash(value)}</Text>
      ),
    },
    {
      title: 'Тип',
      key: 'type',
      width: 115,
      align: 'center',
      render: (_, node) => node._isGroup ? { children: null, props: { colSpan: 0 } } : (
        <ElementTypeTag node={node} />
      ),
    },
    {
      title: 'Кол-во',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 75,
      align: 'center',
      render: (value, node) => node._isGroup ? { children: null, props: { colSpan: 0 } } : valueOrDash(value),
    },
    {
      title: 'Масса, кг',
      dataIndex: 'massa',
      key: 'massa',
      width: 95,
      align: 'right',
      render: (value, node) => {
        if (node._isGroup) return { children: null, props: { colSpan: 0 } };
        return formatMass(value);
      },
    },
    {
      title: 'Материал',
      dataIndex: 'material',
      key: 'material',
      width: 180,
      render: (value, node) => node._isGroup ? { children: null, props: { colSpan: 0 } } : (
        <Text className="preview-material">{valueOrDash(value)}</Text>
      ),
    },
    {
      title: 'Статус',
      key: 'status',
      width: 75,
      align: 'center',
      render: (_, node) => node._isGroup ? { children: null, props: { colSpan: 0 } } : (
        <StatusIndicator status={getNodeStatus(node)} />
      ),
    },
    {
      title: 'Серии',
      dataIndex: 'series',
      key: 'series',
      width: 190,
      render: (series, node) => node._isGroup ? { children: null, props: { colSpan: 0 } } : (
        <SeriesList series={series} />
      ),
    },
  ];
}

const TABLE_COLUMNS = createColumns();

function GroupedAssemblyTable({
  nodes,
  expandedKeys,
  onToggleExpand,
  level = 0,
  defaultExpandedKeys = [],
}) {
  const dataSource = useMemo(() => buildGroupedRows(nodes), [nodes]);

  const assemblyKeys = useMemo(
    () => nodes
      .filter((node) => node._isAssembly && node.children?.length)
      .map((node) => node.key),
    [nodes],
  );

  return (
    <div className={`preview-nested-table preview-nested-level-${Math.min(level, 5)}`}>
      <Table
        className="preview-table preview-hierarchy-table"
        columns={TABLE_COLUMNS}
        dataSource={dataSource}
        rowKey="key"
        size="small"
        pagination={false}
        bordered={false}
        tableLayout="fixed"
        expandable={{
          expandedRowKeys: expandedKeys.filter((key) => assemblyKeys.includes(key)),
          onExpand: (expanded, record) => onToggleExpand(record.key, expanded),
          rowExpandable: (record) =>
            !record._isGroup &&
            record._isAssembly &&
            Array.isArray(record.children) &&
            record.children.length > 0,
          expandedRowRender: (record) => (
            <div className="preview-expanded-assembly">
              <div className="preview-expanded-caption">
                <span className="preview-expanded-caption-line" />
                <span>
                  Состав сборки: <strong>{valueOrDash(record.obozn)}</strong>
                </span>
                <Tag>{record.children.length} позиций первого уровня</Tag>
              </div>
              <GroupedAssemblyTable
                nodes={record.children}
                expandedKeys={expandedKeys}
                onToggleExpand={onToggleExpand}
                level={level + 1}
              />
            </div>
          ),
          expandIcon: ({ expanded, onExpand, record }) => {
            if (
              record._isGroup ||
              !record._isAssembly ||
              !record.children?.length
            ) {
              return <span className="preview-expand-placeholder" />;
            }

            return (
              <button
                type="button"
                className={`preview-expand-button ${expanded ? 'is-expanded' : ''}`}
                onClick={(event) => onExpand(record, event)}
                aria-label={expanded ? 'Свернуть сборку' : 'Раскрыть сборку'}
                title={expanded ? 'Свернуть состав сборки' : 'Раскрыть состав сборки'}
              >
                {expanded ? '−' : '+'}
              </button>
            );
          },
        }}
        rowClassName={(record) => {
          if (record._isGroup) return 'preview-row-group';
          if (record._isAssembly) return 'preview-row-assembly';

          const status = getNodeStatus(record);
          return `preview-row-${status}`;
        }}
        scroll={level === 0 ? { x: 1115 } : undefined}
        locale={{ emptyText: 'Нет элементов в этой группе' }}
      />
    </div>
  );
}

export default function AssemblyPreviewModal({
  open,
  onCancel,
  onConfirm,
  onRefresh,
  loading = false,
  confirming = false,
  data = [],
  selectedRow = null,
  canConfirm = true,
}) {
  const [expandedKeys, setExpandedKeys] = useState([]);

  const nodes = useMemo(
    () => (Array.isArray(data) ? data : []),
    [data],
  );

  const tableData = useMemo(
    () => prepareTree(nodes),
    [nodes],
  );

  const allNodes = useMemo(
    () => collectAllNodes(tableData),
    [tableData],
  );

  const allExpandableKeys = useMemo(
    () => collectExpandableKeys(tableData),
    [tableData],
  );

  useEffect(() => {
    // При загрузке нового состава автоматически показываем содержимое головной сборки.
    const rootAssemblyKeys = tableData
      .filter((node) => node._isAssembly && node.children?.length)
      .map((node) => node.key);

    setExpandedKeys(rootAssemblyKeys);
  }, [tableData]);

  const statistics = useMemo(() => {
    const suitable = allNodes.filter(
      (node) => node.fitsSeries === true,
    ).length;

    const unsuitable = allNodes.filter(
      (node) => node.fitsSeries === false,
    ).length;

    return {
      total: allNodes.length,
      suitable,
      unsuitable,
      unchecked: allNodes.length - suitable - unsuitable,
    };
  }, [allNodes]);

  const toggleExpand = (key, expanded) => {
    setExpandedKeys((previous) => {
      if (expanded) {
        return previous.includes(key) ? previous : [...previous, key];
      }

      return previous.filter((item) => item !== key);
    });
  };

  const handleExpandAll = () => {
    setExpandedKeys(allExpandableKeys);
  };

  const handleCollapseAll = () => {
    setExpandedKeys([]);
  };

  const assemblyDesign =
    selectedRow?.komplektovkaDesign ||
    selectedRow?.slZapiskaObozn ||
    'Не указано';

  // Номер изделия берём из корневого узла PDM — сохраняем существующий источник данных.
  const productNumber = nodes[0]?.izdelieNumber;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width="96vw"
      style={{ top: 18, maxWidth: 1600 }}
      destroyOnHidden={false}
      closable={!confirming}
      maskClosable={false}
      className="assembly-preview-modal"
      title={null}
    >
      <div className="assembly-preview">
        <div className="preview-heading">
          <div className="preview-heading-main">
            <span className="preview-heading-icon">
              <TableOutlined />
            </span>

            <div>
              <Title level={3}>
                Предпросмотр комплектовочной ведомости
              </Title>
              <Text type="secondary">
                Проверка состава перед формированием КВ
              </Text>
            </div>

            {selectedRow && (
              <Tag color="processing">
                Запись № {valueOrDash(selectedRow.number)}
              </Tag>
            )}
          </div>
        </div>

        <div className="preview-summary">
          <div className="preview-summary-item">
            <Text type="secondary">Служебная записка:</Text>
            <Text strong>{valueOrDash(selectedRow?.slZapiskaObozn)}</Text>
          </div>

          <div className="preview-summary-item">
            <Text type="secondary">Идентификатор СЗ:</Text>
            <Text strong>{valueOrDash(selectedRow?.slZapiskaId)}</Text>
          </div>

          <div className="preview-summary-item">
            <Text type="secondary">Спецификация:</Text>
            <Text strong>{valueOrDash(selectedRow?.specifId)}</Text>
          </div>

          <div className="preview-summary-item">
            <Text type="secondary">Сборка:</Text>
            <Text strong>{assemblyDesign}</Text>
          </div>

          <div className="preview-summary-item">
            <Text type="secondary">Изделие:</Text>
            <Text strong>{valueOrDash(productNumber)}</Text>
          </div>

          <div className="preview-summary-item">
            <Text type="secondary">Всего элементов:</Text>
            <Text strong>{statistics.total}</Text>
          </div>
        </div>

        <div className="preview-legend">
          <span className="preview-legend-item">
            <i className="preview-legend-square preview-legend-green" />
            Подходит: <strong>{statistics.suitable}</strong>
          </span>
          <span className="preview-legend-item">
            <i className="preview-legend-square preview-legend-red" />
            Не подходит: <strong>{statistics.unsuitable}</strong>
          </span>
          <span className="preview-legend-item">
            <i className="preview-legend-square preview-legend-gray" />
            Нет проверки: <strong>{statistics.unchecked}</strong>
          </span>
          <span className="preview-legend-item">
            <i className="preview-legend-line" />
            Вложенные сборки
          </span>
        </div>

        <div className="preview-toolbar">
          <Space wrap>
            <Button
              type="primary"
              icon={<ExpandAltOutlined />}
              onClick={handleExpandAll}
              disabled={allExpandableKeys.length === 0}
            >
              Развернуть все сборки
            </Button>

            <Button
              icon={<DownSquareOutlined />}
              onClick={handleCollapseAll}
              disabled={expandedKeys.length === 0}
            >
              Свернуть всё
            </Button>

            <Button
              icon={<ReloadOutlined />}
              onClick={onRefresh}
              loading={loading}
            >
              Обновить
            </Button>
          </Space>
        </div>

        <div className="preview-table-wrapper">
          {loading ? (
            <div className="preview-empty">
              <Text type="secondary">Загрузка структуры PDM...</Text>
            </div>
          ) : tableData.length === 0 ? (
            <Empty description="Структура не содержит элементов" />
          ) : (
            <GroupedAssemblyTable
              nodes={tableData}
              expandedKeys={expandedKeys}
              onToggleExpand={toggleExpand}
              level={0}
            />
          )}
        </div>

        <Divider className="preview-divider" />

        <div className="preview-actions">
          <Text type="secondary" className="preview-actions-hint">
            Проверьте состав и соответствие серий перед формированием
          </Text>

          <Space>
            <Button danger onClick={onCancel} disabled={confirming}>
              Отмена
            </Button>

            <Button
              type="primary"
              className="preview-confirm-button"
              icon={<CheckCircleFilled />}
              onClick={onConfirm}
              loading={confirming}
              disabled={
                !canConfirm ||
                loading ||
                nodes.length === 0 ||
                confirming
              }
            >
              Подтвердить формирование КВ
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
}
