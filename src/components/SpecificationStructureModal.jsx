
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Empty,
  Modal,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';

import {
  FileSearchOutlined,
} from '@ant-design/icons';

import { kvApi } from '../api/client';
import '../styles/specification-structure.css';

const { Text, Title } = Typography;

const valueOrDash = (value) =>
  value === null || value === undefined || value === ''
    ? '—'
    : value;

/**
 * Названия известных разделов.
 *
 * Если в вашей БД используются другие значения idDivision,
 * достаточно скорректировать этот объект.
 */
const DIVISION_NAMES = {
  2: 'ДОКУМЕНТАЦИЯ',
  3: 'СБОРОЧНЫЕ ЕДИНИЦЫ',
  4: 'ДЕТАЛИ',
  5: 'СТАНДАРТНЫЕ ИЗДЕЛИЯ',
  6: 'ПОКУПНЫЕ ИЗДЕЛИЯ',
  7: 'МАТЕРИАЛЫ',
};

function getDivisionName(idDivision) {
  return (
    DIVISION_NAMES[idDivision] ||
    `РАЗДЕЛ ${valueOrDash(idDivision)}`
  );
}

/**
 * Форматирование серии.
 *
 * MINI = 100, MAXI = 100 -> Действует на 100
 * MINI = 8,   MAXI = 100 -> Действует с 8 по 100
 * MINI = 100, MAXI = null -> Действует с 100
 * MINI = null, MAXI = 100 -> Действует по 100
 * MINI = null, MAXI = null -> Без ограничения
 */
function getSeriesDescription(series) {
  const mini = series.mini;
  const maxi = series.maxi;

  if (mini !== null && mini !== undefined &&
    maxi !== null && maxi !== undefined) {
    if (Number(mini) === Number(maxi)) {
      return `Действует на ${mini}`;
    }

    return `Действует с ${mini} по ${maxi}`;
  }

  if (mini !== null && mini !== undefined) {
    return `Действует с ${mini}`;
  }

  if (maxi !== null && maxi !== undefined) {
    return `Действует по ${maxi}`;
  }

  return 'Без ограничения';
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  return value;
}

/**
 * Нормализация ответа backend.
 *
 * Поддерживает:
 * - массив;
 * - { items: [] };
 * - { content: [] };
 * - { rows: [] }.
 */
function normalizeResponse(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.content)) {
    return response.content;
  }

  if (Array.isArray(response?.rows)) {
    return response.rows;
  }

  return [];
}

/**
 * Группировка строк по idDivision.
 *
 * Внутри каждой группы сохраняются все позиции.
 * Серии остаются вложенными в родительскую позицию.
 */
function buildTableData(structure) {
  const grouped = new Map();

  structure.forEach((item) => {
    const divisionId = item.idDivision ?? 'unknown';

    if (!grouped.has(divisionId)) {
      grouped.set(divisionId, []);
    }

    grouped.get(divisionId).push(item);
  });

  const sortedGroups = [...grouped.entries()].sort(([a], [b]) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;

    return Number(a) - Number(b);
  });

  const result = [];

  sortedGroups.forEach(([divisionId, items]) => {
    result.push({
      key: `division-${divisionId}`,
      rowType: 'division',
      idDivision: divisionId,
      divisionName: getDivisionName(divisionId),
    });

    const sortedItems = [...items].sort(
      (a, b) => Number(a.id ?? 0) - Number(b.id ?? 0),
    );

    sortedItems.forEach((item) => {
      result.push({
        ...item,
        key: `structure-${item.id}`,
        rowType: 'structure',
        series: Array.isArray(item.series) ? item.series : [],
      });
    });
  });

  return result;
}

/**
 * Вложенная таблица серий.
 *
 * Каждая серия — отдельная запись с собственными колонками.
 */
function SeriesTable({ series }) {
  const columns = [
    {
      title: 'Серия',
      key: 'seriesDescription',
      render: (_, record) => (
        <Text className="specification-series-description">
          {getSeriesDescription(record)}
        </Text>
      ),
    },
    {
      title: 'Количество',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 110,
      align: 'center',
      render: formatNumber,
    },
    {
      title: 'Масса',
      dataIndex: 'massa',
      key: 'massa',
      width: 110,
      align: 'center',
      render: formatNumber,
    },
    {
      title: 'Габариты',
      dataIndex: 'dimensions',
      key: 'dimensions',
      width: 180,
      render: formatNumber,
    },
  ];

  const dataSource = series.map((item, index) => ({
    ...item,
    key: item.id ?? `${item.ssid}-${index}`,
  }));

  return (
    <div className="specification-series-wrapper">
      <div className="specification-series-heading">
        <Text strong>Серии позиции</Text>
        <Tag color="blue">{series.length}</Tag>
      </div>

      <Table
        className="specification-series-table"
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
        bordered
        showHeader
        rowKey="key"
      />
    </div>
  );
}

export default function SpecificationStructureModal({
  open,
  onClose,
  specifId,
  specificationNumber,
}) {
  const [loading, setLoading] = useState(false);
  const [structure, setStructure] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !specifId) {
      return undefined;
    }

    let active = true;

    const loadStructure = async () => {
      setLoading(true);
      setError(null);
      setStructure([]);

      try {
        const response =
          await kvApi.getSpecificationStructure(specifId);

        if (!active) return;

        setStructure(normalizeResponse(response));
      } catch (requestError) {
        if (!active) return;

        setError(
          requestError?.message ||
          'Не удалось загрузить структуру спецификации',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadStructure();

    return () => {
      active = false;
    };
  }, [open, specifId]);

  const tableData = useMemo(
    () => buildTableData(structure),
    [structure],
  );

  const structureCount = structure.length;

  const seriesCount = structure.reduce(
    (total, item) => total + (item.series?.length || 0),
    0,
  );


  const columns = [
    {
      title: 'Обозначение',
      dataIndex: 'obozn',
      key: 'obozn',
      width: 200,
      render: (value, record) => {
        if (record.rowType === 'division') {
          return {
            children: (
              <div className="specification-division-title">
                {record.divisionName}
              </div>
            ),
            props: { colSpan: 9 },
          };
        }

        return (
          <Text strong className="specification-obozn">
            {valueOrDash(value)}
          </Text>
        );
      },
    },
    {
      title: 'Наименование',
      dataIndex: 'naim',
      key: 'naim',
      width: 260,
      render: (value, record) => {
        if (record.rowType === 'division') {
          return { children: null, props: { colSpan: 0 } };
        }

        return (
          <span className="specification-naim">
            {valueOrDash(value)}
          </span>
        );
      },
    },
    {
      title: 'Зона',
      dataIndex: 'zone',
      key: 'zone',
      width: 75,
      align: 'center',
      render: (value, record) => {
        if (record.rowType === 'division') {
          return { children: null, props: { colSpan: 0 } };
        }

        return valueOrDash(value);
      },
    },
    {
      title: 'Формат',
      dataIndex: 'format',
      key: 'format',
      width: 75,
      align: 'center',
      render: (value, record) => {
        if (record.rowType === 'division') {
          return { children: null, props: { colSpan: 0 } };
        }

        return valueOrDash(value);
      },
    },
    {
      title: 'Поз.',
      dataIndex: 'pos',
      key: 'pos',
      width: 65,
      align: 'center',
      render: (value, record) => {
        if (record.rowType === 'division') {
          return { children: null, props: { colSpan: 0 } };
        }

        return valueOrDash(value);
      },
    },
    {
      title: 'Количество',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 95,
      align: 'center',
      render: (value, record) => {
        if (record.rowType === 'division') {
          return { children: null, props: { colSpan: 0 } };
        }

        return valueOrDash(value);
      },
    },
    {
      title: 'Масса',
      dataIndex: 'massa',
      key: 'massa',
      width: 95,
      align: 'center',
      render: (value, record) => {
        if (record.rowType === 'division') {
          return { children: null, props: { colSpan: 0 } };
        }

        return valueOrDash(value);
      },
    },
    {
      title: 'Материал',
      dataIndex: 'material',
      key: 'material',
      width: 180,
      render: (value, record) => {
        if (record.rowType === 'division') {
          return { children: null, props: { colSpan: 0 } };
        }

        return valueOrDash(value);
      },
    },
    {
      title: 'Примечание',
      key: 'note',
      width: 160,
      render: (_, record) => {
        if (record.rowType === 'division') {
          return { children: null, props: { colSpan: 0 } };
        }

        return (
          <Text type="secondary">
            {valueOrDash(record.note)}
          </Text>
        );
      },
    },
  ];


  return (
    <Modal
      className="specification-structure-modal"
      title={
        <div className="specification-modal-title">
          <div className="specification-modal-icon">
            <FileSearchOutlined />
          </div>

          <div>
            <Title level={5}>
              Полная структура спецификации
            </Title>

            <Text type="secondary">
              Спецификация № {valueOrDash(specifId)}
              {specificationNumber
                ? ` · Изделие ${specificationNumber}`
                : ''}
            </Text>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width="94vw"
      style={{ top: 24 }}
      destroyOnHidden
      maskClosable={!loading}
    >
      <div className="specification-modal-content">
        <div className="specification-summary">
          <div className="specification-summary-item">
            <Text type="secondary">Позиций:</Text>
            <Text strong>{structureCount}</Text>
          </div>

          <div className="specification-summary-item">
            <Text type="secondary">Серий:</Text>
            <Text strong>{seriesCount}</Text>
          </div>

          <div className="specification-summary-item">
            <Text type="secondary">ID спецификации:</Text>
            <Text strong>{valueOrDash(specifId)}</Text>
          </div>
        </div>

        {error && (
          <Alert
            className="specification-error"
            type="error"
            showIcon
            message={error}
          />
        )}

        <div className="specification-table-container">
          <Spin spinning={loading}>
            {!loading && !error && tableData.length === 0 ? (
              <Empty
                description="Структура спецификации не найдена"
              />
            ) : (
              <Table
                className="specification-structure-table"
                columns={columns}
                dataSource={tableData}
                rowKey="key"
                bordered
                size="small"
                pagination={false}
                scroll={{
                  x: 1200,
                  y: 'calc(100vh - 330px)',
                }}
                expandable={{
                  expandedRowRender: (record) => (
                    <SeriesTable series={record.series || []} />
                  ),

                  rowExpandable: (record) =>
                    record.rowType === 'structure' &&
                    Array.isArray(record.series) &&
                    record.series.length > 0,

                  expandRowByClick: false,
                }}
                rowClassName={(record) => {
                  if (record.rowType === 'division') {
                    return 'specification-division-row';
                  }

                  return 'specification-structure-row';
                }}
              />
            )}
          </Spin>
        </div>
      </div>
    </Modal>
  );
}
