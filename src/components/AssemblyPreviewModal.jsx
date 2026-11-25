import { useMemo, useState } from 'react';
import {
  Button,
  Divider,
  Empty,
  Modal,
  Space,
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
  DownOutlined,
  RightOutlined,
  AppstoreOutlined,
  ToolOutlined,
  BuildOutlined,
  ShoppingOutlined,
  ExperimentOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

import '../styles/assembly-preview.css';

const { Text, Title } = Typography;

const DIVISION_GROUPS = [
  {
    key: 'documentation',
    title: 'Документация',
    order: 0,
    icon: FileTextOutlined,
    match: ['документ', 'чертеж', 'чертёж'],
  },
  {
    key: 'assembly',
    title: 'Сборочные единицы',
    order: 1,
    icon: AppstoreOutlined,
    match: ['сбор', 'узел', 'агрегат'],
  },
  {
    key: 'standard',
    title: 'Стандартные изделия',
    order: 2,
    icon: BuildOutlined,
    match: ['стандарт'],
  },
  {
    key: 'material',
    title: 'Материалы',
    order: 3,
    icon: ExperimentOutlined,
    match: ['материал'],
  },
  {
    key: 'detail',
    title: 'Детали',
    order: 4,
    icon: ToolOutlined,
    match: ['детал'],
  },
  {
    key: 'purchased',
    title: 'Покупные изделия',
    order: 5,
    icon: ShoppingOutlined,
    match: ['покуп'],
  },
];

const UNKNOWN_GROUP = {
  key: 'other',
  title: 'Прочие элементы',
  order: 99,
  icon: ToolOutlined,
  match: [],
};

function valueOrDash(value) {
  return value === null || value === undefined || value === ''
    ? '—'
    : value;
}

function normalizeDivisionName(node) {
  return String(node?.divisionName ?? '').trim().toLowerCase();
}

function getDivisionGroup(node) {
  const divisionName = normalizeDivisionName(node);

  if (divisionName) {
    const found = DIVISION_GROUPS.find((group) =>
      group.match.some((word) => divisionName.includes(word)),
    );

    if (found) return found;

    return {
      ...UNKNOWN_GROUP,
      title: String(node.divisionName).trim(),
    };
  }

  const rawType = String(
    node?.elementType ??
    node?.type ??
    node?.kind ??
    node?.tip ??
    node?.typeCode ??
    '',
  ).trim().toLowerCase();

  if (rawType.includes('сбор') || rawType === 'sb' || rawType === 'сб') {
    return DIVISION_GROUPS[1];
  }
  if (rawType.includes('стандарт') || rawType === 'st' || rawType === 'ст') {
    return DIVISION_GROUPS[2];
  }
  if (rawType.includes('материал') || rawType === 'mat' || rawType === 'мат') {
    return DIVISION_GROUPS[3];
  }
  if (rawType.includes('детал') || rawType === 'det' || rawType === 'дет') {
    return DIVISION_GROUPS[4];
  }
  if (rawType.includes('покуп') || rawType === 'pok' || rawType === 'пок') {
    return DIVISION_GROUPS[5];
  }

  // В текущей модели корневая сборка имеет ID_DIVISION = 3.
  if (Number(node?.idDivision) === 3) {
    return DIVISION_GROUPS[1];
  }

  return UNKNOWN_GROUP;
}

function isAssembly(node) {
  return (
    Number(node?.idDivision) === 3 ||
    getDivisionGroup(node).key === 'assembly'
  );
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

function formatMass(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : value;
}

function getNodeStatus(node) {
  if (node?.fitsSeries === true) return 'success';
  if (node?.fitsSeries === false) return 'error';
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
      <span className={`bom-status-dot bom-status-${status}`} />
    </Tooltip>
  );
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
      massa !== undefined && massa !== null
        ? ` · ${Number(massa).toFixed(2)} кг`
        : ''
    }`;
  }

  return series.name ?? series.design ?? series.obozn ?? series.value ?? 'Серия';
}

function SeriesView({ series }) {
  if (!Array.isArray(series) || series.length === 0) {
    return <Text className="bom-muted">Нет серий</Text>;
  }

  return (
    <div className="bom-series-list">
      {series.map((item, index) => {
        const label = getSeriesLabel(item);
        const fits = typeof item === 'object' && item !== null
          ? item.fitsSeries
          : undefined;

        return (
          <Tag
            key={`${label}-${index}`}
            color={fits === true ? 'success' : fits === false ? 'error' : undefined}
            className="bom-series-tag"
          >
            {label}
          </Tag>
        );
      })}
    </div>
  );
}

function TypeBadge({ node }) {
  const group = node._divisionGroup || getDivisionGroup(node);

  return (
    <Tag color={group.key === 'assembly' ? 'purple' : 'default'} className={`bom-type-badge bom-type-${group.key}`}>
      {group.key === 'assembly' ? 'Сборка' : group.title}
    </Tag>
  );
}

function NodeMetrics({ node }) {
  return (
    <div className="bom-node-metrics">
      <span><Text type="secondary">Кол-во</Text><strong>{valueOrDash(node.quantity)}</strong></span>
      <span><Text type="secondary">Масса</Text><strong>{formatMass(node.massa)}{formatMass(node.massa) !== '—' ? ' кг' : ''}</strong></span>
    </div>
  );
}

function ElementRow({ node, expanded, expandedKeys, onToggle, level = 0 }) {
  const expandable = node._isAssembly && node.children?.length > 0;
  const status = getNodeStatus(node);

  return (
    <div className={`bom-element-row ${status !== 'default' ? `bom-element-${status}` : ''}`}>
      <div className="bom-element-main">
        <div className="bom-element-tree-indent" style={{ '--bom-level': level }} />

        {expandable ? (
          <button
            type="button"
            className={`bom-expand-button ${expanded ? 'is-expanded' : ''}`}
            onClick={() => onToggle(node.key)}
            aria-label={expanded ? 'Свернуть сборку' : 'Раскрыть сборку'}
            title={expanded ? 'Свернуть состав сборки' : 'Раскрыть состав сборки'}
          >
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </button>
        ) : (
          <span className="bom-expand-placeholder" />
        )}

        <span className={`bom-element-icon ${node._isAssembly ? 'is-assembly' : ''}`}>
          {node._isAssembly ? <AppstoreOutlined /> : <ToolOutlined />}
        </span>

        <div className="bom-element-identity">
          <div className="bom-element-designation">
            <Text strong>{valueOrDash(node.obozn)}</Text>
            {node._isAssembly && <Tag color="purple">Сборка</Tag>}
          </div>
          <Text className="bom-element-name">{valueOrDash(node.naim)}</Text>
          {node._isAssembly && expandable && (
            <Text className="bom-child-hint">
              Содержит {node.children.length} непосредственных элементов
            </Text>
          )}
        </div>

        <div className="bom-element-type">
          {!node._isAssembly && <TypeBadge node={node} />}
        </div>

        <NodeMetrics node={node} />

        <div className="bom-element-material">
          <Text>{valueOrDash(node.material)}</Text>
        </div>

        <div className="bom-element-series">
          <SeriesView series={node.series} />
        </div>

        <div className="bom-element-status">
          <StatusIndicator status={status} />
        </div>
      </div>

      {expandable && expanded && (
        <div className="bom-nested-content">
          <div className="bom-nested-caption">
            <span className="bom-nested-line" />
            <span>Состав сборки {valueOrDash(node.obozn)}</span>
            <Tag>{collectAllNodes(node.children).length} элементов</Tag>
          </div>
          <GroupedContents
            nodes={node.children}
            expandedKeys={[]}
            onToggle={onToggle}
            level={level + 1}
            parentExpandedKeys={undefined}
            rootExpandedKeys={undefined}
          />
        </div>
      )}
    </div>
  );
}

function GroupedContents({
  nodes,
  expandedKeys,
  onToggle,
  level = 0,
}) {
  const groups = useMemo(() => groupNodes(nodes), [nodes]);

  return (
    <div className={`bom-groups bom-level-${Math.min(level, 5)}`}>
      {groups.map((group) => {
        const GroupIcon = group.icon;

        return (
          <section className="bom-group" key={`${level}-${group.key}`}>
            <div className="bom-group-heading">
              <div className="bom-group-title">
                <GroupIcon />
                <span>{group.title}</span>
                <span className="bom-group-count">{group.nodes.length}</span>
              </div>
            </div>

            <div className="bom-group-items">
              {group.nodes.map((node) => (
                <ElementRow
                  key={node.key}
                  node={node}
                  expanded={expandedKeys.includes(node.key)}
                  expandedKeys={expandedKeys}
                  onToggle={onToggle}
                  level={level}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function RootAssembly({ node, expandedKeys, onToggle }) {
  const status = getNodeStatus(node);
  const groups = groupNodes(node.children || []);
  const totalChildren = collectAllNodes(node.children || []).length;

  return (
    <div className={`bom-root-card ${status !== 'default' ? `bom-root-${status}` : ''}`}>
      <div className="bom-root-header">
        <div className="bom-root-title">
          <span className="bom-root-icon"><AppstoreOutlined /></span>
          <div>
            <div className="bom-root-designation">
              <Title level={4}>{valueOrDash(node.obozn)}</Title>
              <Tag color="purple">Головная сборка</Tag>
            </div>
            <Text className="bom-root-name">{valueOrDash(node.naim)}</Text>
          </div>
        </div>
        <StatusIndicator status={status} />
      </div>

      <div className="bom-root-meta">
        <span>Количество <strong>{valueOrDash(node.quantity)}</strong></span>
        <span>Масса <strong>{formatMass(node.massa)}{formatMass(node.massa) !== '—' ? ' кг' : ''}</strong></span>
        <span>Всего элементов <strong>{totalChildren}</strong></span>
      </div>

      <div className="bom-root-content">
        <div className="bom-contents-title">
          <div>
            <Text strong>Состав головной сборки</Text>
            <Text type="secondary">Разделён по подразделениям PDM</Text>
          </div>
          <Tag>{groups.length} групп</Tag>
        </div>

        <GroupedContents
          nodes={node.children || []}
          expandedKeys={expandedKeys}
          onToggle={onToggle}
          level={0}
        />
      </div>
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

  const preparedNodes = useMemo(
    () => prepareTree(nodes),
    [nodes],
  );

  const allNodes = useMemo(
    () => collectAllNodes(preparedNodes),
    [preparedNodes],
  );

  const statistics = useMemo(() => {
    const suitable = allNodes.filter((node) => node.fitsSeries === true).length;
    const unsuitable = allNodes.filter((node) => node.fitsSeries === false).length;

    return {
      total: allNodes.length,
      suitable,
      unsuitable,
      unchecked: allNodes.length - suitable - unsuitable,
    };
  }, [allNodes]);

  const toggleExpanded = (key) => {
    setExpandedKeys((previous) =>
      previous.includes(key)
        ? previous.filter((item) => item !== key)
        : [...previous, key],
    );
  };

  const handleExpandAll = () => {
    setExpandedKeys(collectExpandableKeys(preparedNodes));
  };

  const handleCollapseAll = () => {
    setExpandedKeys([]);
  };

  const assemblyDesign =
    selectedRow?.komplektovkaDesign ||
    selectedRow?.slZapiskaObozn ||
    'Не указано';

  // Номер изделия берём из корневого узла PDM, как и в исходной версии.
  const productNumber = nodes[0]?.izdelieNumber;

  const roots = preparedNodes;

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
      <div className="assembly-preview bom-explorer">
        <div className="preview-heading">
          <div className="preview-heading-main">
            <span className="preview-heading-icon"><TableOutlined /></span>
            <div>
              <Title level={3}>Предпросмотр комплектовочной ведомости</Title>
              <Text type="secondary">Структура изделия и состав вложенных сборок</Text>
            </div>
            {selectedRow && (
              <Tag color="processing">Запись № {valueOrDash(selectedRow.number)}</Tag>
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

        <div className="bom-status-summary">
          <span><i className="bom-summary-dot bom-summary-ok" />Подходит: <strong>{statistics.suitable}</strong></span>
          <span><i className="bom-summary-dot bom-summary-error" />Не подходит: <strong>{statistics.unsuitable}</strong></span>
          <span><i className="bom-summary-dot bom-summary-neutral" />Не проверено: <strong>{statistics.unchecked}</strong></span>
        </div>

        <div className="preview-toolbar">
          <Space wrap>
            <Button
              type="primary"
              icon={<ExpandAltOutlined />}
              onClick={handleExpandAll}
              disabled={collectExpandableKeys(preparedNodes).length === 0}
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
            <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
              Обновить
            </Button>
          </Space>
        </div>

        <div className="bom-explorer-scroll">
          {loading ? (
            <div className="preview-empty">
              <Text type="secondary">Загрузка структуры PDM...</Text>
            </div>
          ) : roots.length === 0 ? (
            <Empty description="Структура не содержит элементов" />
          ) : (
            <div className="bom-root-list">
              {roots.map((root) => (
                <RootAssembly
                  key={root.key}
                  node={root}
                  expandedKeys={expandedKeys}
                  onToggle={toggleExpanded}
                />
              ))}
            </div>
          )}
        </div>

        <Divider className="preview-divider" />

        <div className="preview-actions">
          <Text type="secondary" className="preview-actions-hint">
            Проверьте состав и соответствие серий перед формированием
          </Text>
          <Space>
            <Button danger onClick={onCancel} disabled={confirming}>Отмена</Button>
            <Button
              type="primary"
              className="preview-confirm-button"
              icon={<CheckCircleFilled />}
              onClick={onConfirm}
              loading={confirming}
              disabled={!canConfirm || loading || nodes.length === 0 || confirming}
            >
              Подтвердить формирование КВ
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
}
