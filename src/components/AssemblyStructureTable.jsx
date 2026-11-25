import { useMemo, useState } from 'react';
import { Table, Tag, Typography } from 'antd';

import '../styles/AssemblyStructureTable.css';

const { Text } = Typography;

const TYPE_ORDER = {
  assembly: 1,
  standard: 2,
  material: 3,
  detail: 4,
  purchased: 5,
  unknown: 99,
};

function valueOrDash(value) {
  return value === null || value === undefined || value === ''
    ? '—'
    : value;
}

function getNodeType(node) {
  const divisionName = String(node?.divisionName || '').trim();

  if (divisionName) {
    const normalized = divisionName.toLowerCase();

    if (normalized.includes('сбор')) return 'assembly';
    if (normalized.includes('стандарт')) return 'standard';
    if (normalized.includes('материал')) return 'material';
    if (normalized.includes('детал')) return 'detail';
    if (normalized.includes('покуп')) return 'purchased';

    return 'unknown';
  }

  const rawType = String(
    node?.elementType ??
    node?.type ??
    node?.kind ??
    node?.tip ??
    node?.typeCode ??
    '',
  ).trim().toLowerCase();

  if (
    rawType.includes('сбор') ||
    rawType === 'sb' ||
    rawType === 'сб'
  ) {
    return 'assembly';
  }

  if (
    rawType.includes('стандарт') ||
    rawType === 'st' ||
    rawType === 'ст'
  ) {
    return 'standard';
  }

  if (
    rawType.includes('материал') ||
    rawType === 'mat' ||
    rawType === 'мат'
  ) {
    return 'material';
  }

  if (
    rawType.includes('детал') ||
    rawType === 'det' ||
    rawType === 'дет'
  ) {
    return 'detail';
  }

  if (
    rawType.includes('покуп') ||
    rawType === 'pok' ||
    rawType === 'пок'
  ) {
    return 'purchased';
  }

  if (Array.isArray(node?.children) && node.children.length > 0) {
    return 'assembly';
  }

  return 'unknown';
}

const TYPE_LABELS = {
  assembly: 'Сборка',
  standard: 'Стандартное',
  material: 'Материал',
  detail: 'Деталь',
  purchased: 'Покупное',
  unknown: 'Не определён',
};

const TYPE_COLORS = {
  assembly: 'purple',
  standard: 'orange',
  material: 'cyan',
  detail: 'green',
  purchased: 'magenta',
  unknown: 'default',
};

function getRowKey(node, parentKey, index) {
  return String(
    node?.id ??
    node?.structureId ??
    node?.idStructure ??
    `${parentKey || 'root'}-${index}`,
  );
}

function getNodeSortOrder(node) {
  const type = getNodeType(node);
  return TYPE_ORDER[type] ?? TYPE_ORDER.unknown;
}

/**
 * Преобразует исходную структуру в дерево Ant Design Table.
 *
 * Сортировка выполняется на каждом уровне отдельно.
 * Исходные массивы не изменяются.
 */
function mapNodes(nodes = [], parentKey = '') {
  const sortedNodes = [...nodes].sort(
    (a, b) => getNodeSortOrder(a) - getNodeSortOrder(b),
  );

  return sortedNodes.map((node, index) => {
    const key = getRowKey(node, parentKey, index);

    const children = Array.isArray(node?.children)
      ? mapNodes(node.children, key)
      : [];

    const type = getNodeType(node);

    return {
      ...node,
      key,
      nodeType: type,
      nodeTypeLabel: TYPE_LABELS[type],
      children: children.length > 0 ? children : undefined,
    };
  });
}

function formatMass(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(2)
    : value;
}

function SeriesTags({ series }) {
  if (!Array.isArray(series) || series.length === 0) {
    return null;
  }

  return (
    <div className="assembly-table-series">
      {series.map((item, index) => (
        <Tag key={`${index}-${item?.mini}-${item?.maxi}`}>
          {valueOrDash(item?.mini)} – {valueOrDash(item?.maxi)}
        </Tag>
      ))}
    </div>
  );
}

export default function AssemblyStructureTable({
  data = [],
  loading = false,
}) {
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  const tableData = useMemo(
    () => mapNodes(Array.isArray(data) ? data : []),
    [data],
  );

  const columns = [
    {
      title: 'Обозначение',
      dataIndex: 'obozn',
      key: 'obozn',
      width: 125,
      render: (value, record) => (
        <div className="assembly-table-design-cell">
          {record.children?.length > 0 && (
            <span className="assembly-table-assembly-icon">
              📦
            </span>
          )}

          <Text className="assembly-table-design">
            {valueOrDash(value)}
          </Text>
        </div>
      ),
    },
    {
      title: 'Наименование',
      dataIndex: 'naim',
      key: 'naim',
      width: 145,
      render: (value, record) => (
        <div className="assembly-table-name-cell">
          <Text className="assembly-table-name">
            {valueOrDash(value)}
          </Text>

          <Tag
            color={TYPE_COLORS[record.nodeType]}
            bordered={false}
            className="assembly-table-type"
          >
            {record.nodeTypeLabel}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Кол-во',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 55,
      align: 'right',
      render: valueOrDash,
    },
    {
      title: 'Масса',
      dataIndex: 'massa',
      key: 'massa',
      width: 65,
      align: 'right',
      render: formatMass,
    },
    {
      title: 'Материал',
      dataIndex: 'material',
      key: 'material',
      width: 125,
      render: (value) => (
        <Text className="assembly-table-material">
          {valueOrDash(value)}
        </Text>
      ),
    },
    {
      title: 'Статус',
      key: 'status',
      width: 85,
      align: 'center',
      render: (_, record) => {
        if (
          record.fitsSeries === null ||
          record.fitsSeries === undefined
        ) {
          return <Text type="secondary">—</Text>;
        }

        return record.fitsSeries ? (
          <Tag color="success">Подходит</Tag>
        ) : (
          <Tag color="error">Не подходит</Tag>
        );
      },
    },
  ];

  return (
    <div className="assembly-structure-table">
      <Table
        className="assembly-structure-ant-table"
        columns={columns}
        dataSource={tableData}
        rowKey="key"
        size="small"
        loading={loading}
        pagination={false}
        bordered={false}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: setExpandedRowKeys,
          childrenColumnName: 'children',
          indentSize: 13,
          expandRowByClick: false,
        }}
        scroll={{ x: 600 }}
        rowClassName={(record) =>
          record.children?.length
            ? 'assembly-table-parent-row'
            : 'assembly-table-leaf-row'
        }
        locale={{
          emptyText: 'Состав спецификации пуст',
        }}
      />

      {tableData.some((node) => node.series?.length > 0) && (
        <div className="assembly-table-series-summary">
          {tableData.map((node) => (
            <SeriesTags
              key={node.key}
              series={node.series}
            />
          ))}
        </div>
      )}
    </div>
  );
}
