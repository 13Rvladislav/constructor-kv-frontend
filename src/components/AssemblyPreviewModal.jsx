
import { useMemo, useState } from 'react';
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
  CloseCircleFilled,
  DownSquareOutlined,
  ExpandAltOutlined,
  ReloadOutlined,
  TableOutlined,
} from '@ant-design/icons';

import '../styles/assembly-preview.css';

const { Text, Title } = Typography;

const TYPE_CONFIG = {
  SB: { label: 'СБ — Сборка', color: 'purple' },
  СБ: { label: 'СБ — Сборка', color: 'purple' },
  DET: { label: 'ДЕТ — Деталь', color: 'green' },
  ДЕТ: { label: 'ДЕТ — Деталь', color: 'green' },
  ST: { label: 'СТ — Стандартное', color: 'orange' },
  СТ: { label: 'СТ — Стандартное', color: 'orange' },
  POK: { label: 'ПОК — Покупное', color: 'magenta' },
  ПОК: { label: 'ПОК — Покупное', color: 'magenta' },
  MAT: { label: 'МАТ — Материал', color: 'cyan' },
  МАТ: { label: 'МАТ — Материал', color: 'cyan' },
};

function valueOrDash(value) {
  return value === null || value === undefined || value === ''
    ? '—'
    : value;
}

function getNodeType(node) {
  const rawType =
    node.elementType ??
    node.type ??
    node.kind ??
    node.tip ??
    node.typeCode ??
    '';

  const normalized = String(rawType).trim().toUpperCase();

  if (TYPE_CONFIG[normalized]) {
    return TYPE_CONFIG[normalized];
  }

  return {
    label: rawType || 'Не указан',
    color: 'default',
  };
}

function getSeriesLabel(series) {
  if (series === null || series === undefined) {
    return '—';
  }

  if (typeof series !== 'object') {
    return String(series);
  }

  const mini = series.mini ?? series.min ?? series.from;
  const maxi = series.maxi ?? series.max ?? series.to;
  const quantity = series.quantity ?? series.count;

  if (mini !== undefined || maxi !== undefined) {
    return `${valueOrDash(mini)}–${valueOrDash(maxi)}${
      quantity !== undefined ? ` × ${quantity}` : ''
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

function getAllNodes(nodes = []) {
  return nodes.reduce((result, node) => {
    result.push(node);

    if (Array.isArray(node.children) && node.children.length > 0) {
      result.push(...getAllNodes(node.children));
    }

    return result;
  }, []);
}

function getNodeStatus(node) {
  if (node.fitsSeries === true) {
    return 'success';
  }

  if (node.fitsSeries === false) {
    return 'error';
  }

  return 'default';
}

function StatusIndicator({ status }) {
  if (status === 'success') {
    return (
      <Tooltip title="Подходит">
        <CheckCircleFilled className="preview-status-icon preview-status-ok" />
      </Tooltip>
    );
  }

  if (status === 'error') {
    return (
      <Tooltip title="Не подходит">
        <CloseCircleFilled className="preview-status-icon preview-status-error" />
      </Tooltip>
    );
  }

  return (
    <Tooltip title="Нет проверки">
      <span className="preview-status-unknown" />
    </Tooltip>
  );
}

function SeriesList({ series }) {
  if (!Array.isArray(series) || series.length === 0) {
    return <Text type="secondary" className="preview-no-series">нет серий</Text>;
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

function ElementTypeTag({ node }) {
  const type = getNodeType(node);

  return (
    <Tag color={type.color} bordered={false} className="preview-type-tag">
      {type.label}
    </Tag>
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
}) {
  const [expandedKeys, setExpandedKeys] = useState([]);

  const nodes = useMemo(
    () => (Array.isArray(data) ? data : []),
    [data],
  );

  const allNodes = useMemo(() => getAllNodes(nodes), [nodes]);

  const statistics = useMemo(() => {
    const suitable = allNodes.filter(
      (node) => node.fitsSeries === true,
    ).length;

    const unsuitable = allNodes.filter(
      (node) => node.fitsSeries === false,
    ).length;

    const unchecked = allNodes.length - suitable - unsuitable;

    return {
      total: allNodes.length,
      suitable,
      unsuitable,
      unchecked,
    };
  }, [allNodes]);

  const tableData = useMemo(() => {
    const mapNodes = (items, parentKey = '') =>
      items.map((node, index) => {
        const key = String(
          node.structureId ??
          node.id ??
          `${parentKey || 'root'}-${index}`,
        );

        return {
          ...node,
          key,
          children: Array.isArray(node.children)
            ? mapNodes(node.children, key)
            : undefined,
        };
      });

    return mapNodes(nodes);
  }, [nodes]);

  const handleExpandAll = () => {
    setExpandedKeys(allNodes.map((node, index) =>
      String(node.structureId ?? node.id ?? `root-${index}`),
    ));
  };

  const handleCollapseAll = () => {
    setExpandedKeys([]);
  };

  const columns = [
    {
      title: 'Обозначение',
      dataIndex: 'obozn',
      key: 'obozn',
      width: 155,
      render: (value, node) => (
        <div className="preview-design-cell">
          <span className="preview-node-icon">
            {node.children?.length ? '📦' : '⚙️'}
          </span>
          <Text className="preview-design">
            {valueOrDash(value)}
          </Text>
        </div>
      ),
    },
    {
      title: 'Наименование',
      dataIndex: 'naim',
      key: 'naim',
      width: 230,
      render: (value) => (
        <Text className="preview-name">
          {valueOrDash(value)}
        </Text>
      ),
    },
    {
      title: 'Тип',
      key: 'type',
      width: 115,
      render: (_, node) => <ElementTypeTag node={node} />,
    },
    {
      title: 'Кол-во',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 75,
      align: 'center',
      render: valueOrDash,
    },
    {
      title: 'Масса, кг',
      dataIndex: 'massa',
      key: 'massa',
      width: 95,
      align: 'right',
      render: (value) =>
        value === null || value === undefined
          ? '—'
          : Number(value).toFixed(2),
    },
    {
      title: 'Материал',
      dataIndex: 'material',
      key: 'material',
      width: 175,
      render: (value) => (
        <Text className="preview-material">
          {valueOrDash(value)}
        </Text>
      ),
    },
    {
      title: 'Статус',
      key: 'status',
      width: 75,
      align: 'center',
      render: (_, node) => (
        <StatusIndicator status={getNodeStatus(node)} />
      ),
    },
    {
      title: 'Серии',
      dataIndex: 'series',
      key: 'series',
      width: 190,
      render: (series) => <SeriesList series={series} />,
    },
  ];

  const assemblyDesign =
    selectedRow?.komplektovkaDesign ||
    selectedRow?.slZapiskaObozn ||
    'Не указано';

  const productDesign =
    selectedRow?.izdelieNumber ||
    selectedRow?.izdelieDesign ||
    selectedRow?.izdelieId ||
    '—';

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width="96vw"
      style={{ top: 18, maxWidth: 1600 }}
      destroyOnHidden={false}
      closable
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

            <Title level={2}>Предпросмотр структуры</Title>

            <Tag color="processing" bordered={false}>
              Перед формированием КВ
            </Tag>
          </div>
        </div>

        <div className="preview-summary">
          <div className="preview-summary-item">
            <Text type="secondary">Сборка:</Text>
            <Text strong>{assemblyDesign}</Text>
          </div>

          <div className="preview-summary-item">
            <Text type="secondary">Изделие:</Text>
            <Tag color="blue">{productDesign}</Tag>
          </div>

          <div className="preview-summary-item">
            <Text type="secondary">Всего элементов:</Text>
            <Text strong>{statistics.total}</Text>
          </div>

          <div className="preview-summary-item">
            <Text type="secondary">Подходит:</Text>
            <Text strong className="preview-count-ok">
              {statistics.suitable}
            </Text>
          </div>

          <div className="preview-summary-item">
            <Text type="secondary">Не подходит:</Text>
            <Text strong className="preview-count-error">
              {statistics.unsuitable}
            </Text>
          </div>

          <div className="preview-summary-item preview-loaded">
            <CheckCircleFilled />
            <Text>
              Загружено ({statistics.total} элементов)
            </Text>
          </div>
        </div>

        <div className="preview-legend">
          <span className="preview-legend-item">
            <i className="preview-legend-square preview-legend-green" />
            Подходит
          </span>

          <span className="preview-legend-item">
            <i className="preview-legend-square preview-legend-red" />
            Не подходит
          </span>

          <span className="preview-legend-item">
            <i className="preview-legend-square preview-legend-gray" />
            Нет проверки
          </span>

          <span className="preview-legend-item">
            <i className="preview-legend-line" />
            Уровень вложенности
          </span>

          {Object.entries(TYPE_CONFIG)
            .filter(([key]) => ['СБ', 'ДЕТ', 'СТ', 'ПОК', 'МАТ'].includes(key))
            .map(([key, type]) => (
              <span className="preview-legend-item" key={key}>
                <i className={`preview-legend-square preview-legend-${key.toLowerCase()}`} />
                {type.label}
              </span>
            ))}
        </div>

        <div className="preview-toolbar">
          <Space wrap>
            <Button
              type="primary"
              icon={<ExpandAltOutlined />}
              onClick={handleExpandAll}
              disabled={allNodes.length === 0}
            >
              Развернуть всё
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
          ) : nodes.length === 0 ? (
            <Empty description="Структура не содержит элементов" />
          ) : (
            <Table
              className="preview-table"
              columns={columns}
              dataSource={tableData}
              rowKey="key"
              size="middle"
              pagination={false}
              bordered={false}
              expandable={{
                childrenColumnName: 'children',
                expandedRowKeys: expandedKeys,
                onExpandedRowsChange: setExpandedKeys,
                indentSize: 20,
              }}
              rowClassName={(record) => {
                const status = getNodeStatus(record);

                if (status === 'success') return 'preview-row-success';
                if (status === 'error') return 'preview-row-error';

                return 'preview-row-unknown';
              }}
              scroll={{ x: 1150, y: 'calc(100vh - 440px)' }}
              locale={{
                emptyText: 'Нет элементов для отображения',
              }}
            />
          )}
        </div>

        <Divider className="preview-divider" />

        <div className="preview-actions">
          <Text type="secondary" className="preview-actions-hint">
            Проверьте состав и соответствие серий перед формированием
          </Text>

          <Space>
            <Button
              danger
              onClick={onCancel}
              disabled={confirming}
            >
              Отмена
            </Button>

            <Button
              type="primary"
              className="preview-confirm-button"
              icon={<CheckCircleFilled />}
              onClick={onConfirm}
              loading={confirming}
              disabled={loading || nodes.length === 0}
            >
              Подтвердить формирование КВ
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
}
