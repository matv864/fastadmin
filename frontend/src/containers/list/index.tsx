import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Breadcrumb,
  Button,
  Col,
  Empty,
  Input,
  message,
  Popconfirm,
  Row,
  Space,
  Tooltip,
} from 'antd';
import querystring from 'querystring';
import {
  DownloadOutlined,
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  FilterOutlined,
  FilterFilled,
} from '@ant-design/icons';
import fileDownload from 'react-file-download';

import { CrudContainer } from 'components/crud-container';
import { ConfigurationContext } from 'providers/ConfigurationProvider';
import { EFieldWidgetType, EModelPermission, IModel, IModelField } from 'interfaces/configuration';
import { getTitleFromFieldName } from 'helpers/title';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteFetcher, getFetcher, postFetcher } from 'fetchers/fetchers';
import { FilterColumn } from './filter-column';
import { transformDataToServer } from 'helpers/transform';
import { TableOrCards } from 'components/table-or-cards';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

export const List: React.FC = () => {
  const { configuration } = useContext(ConfigurationContext);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t: _t } = useTranslation('List');
  const { model } = useParams();

  const [filters, setFilters] = useState<any>({});
  const [search, setSearch] = useState<string | undefined>();
  const [page, setPage] = useState<number>(DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<string | undefined>();

  const modelConfiguration: IModel | undefined = configuration.models.find(
    (item: IModel) => item.name === model
  );

  useEffect(() => {
    if (modelConfiguration?.list_per_page) {
      setPageSize(modelConfiguration?.list_per_page);
    }
  }, [modelConfiguration?.list_per_page]);

  const columns = useMemo(() => {
    return (modelConfiguration || { fields: [] }).fields
      .filter((field: IModelField) => !!field.list_configuration)
      .map((field: IModelField) => {
        const filterCondition =
          field.list_configuration?.filter_condition || `${field.name}__icontains`;
        return {
          title: getTitleFromFieldName(field.name),
          dataIndex: field.name,
          key: field.name,
          sorter: field.list_configuration?.sorter,
          filterIcon: !!field.list_configuration?.filter_widget_type ? (
            filters[filterCondition] !== undefined ? (
              <Tooltip title={_t('Click to reset this filter')}>
                <FilterFilled style={{ color: 'red' }} />
              </Tooltip>
            ) : (
              <Tooltip title={_t('Click to filter')}>
                <FilterOutlined />
              </Tooltip>
            )
          ) : undefined,
          filterDropdown: !!field.list_configuration?.filter_widget_type
            ? ({ confirm, clearFilters }: any) => {
                const onReset = () => {
                  delete filters[filterCondition];
                  setFilters({ ...filters });
                  setPage(DEFAULT_PAGE);
                  setPageSize(DEFAULT_PAGE_SIZE);
                  clearFilters();
                  confirm();
                };
                const onFilter = (value: any) => {
                  filters[filterCondition] = value;
                  setFilters({ ...filters });
                  setPage(DEFAULT_PAGE);
                  setPageSize(DEFAULT_PAGE_SIZE);
                  confirm();
                };
                return (
                  <FilterColumn
                    widgetType={field.list_configuration?.filter_widget_type as EFieldWidgetType}
                    widgetProps={field.list_configuration?.filter_widget_props}
                    value={filters[filterCondition]}
                    onFilter={onFilter}
                    onReset={onReset}
                  />
                );
              }
            : undefined,
          render: (value: any, record: any) => {
            if (field?.list_configuration?.is_link) {
              return (
                <Link to={`/change/${model}/${record.id}`}>
                  {value || field.list_configuration?.empty_value_display || '-'}
                </Link>
              );
            }
            return value || field.list_configuration?.empty_value_display || '-';
          },
        };
      });
  }, [modelConfiguration, filters, _t, model]);

  const queryString = querystring.stringify({
    search: search,
    sort_by: sortBy,
    offset: (page - 1) * pageSize,
    limit: pageSize,
    ...transformDataToServer(filters),
  });

  const { data, isLoading } = useQuery([`/list/${model}`, queryString], () =>
    getFetcher(`/list/${model}?${queryString}`)
  );

  const exportQueryString = querystring.stringify({
    search: search,
    sort_by: sortBy,
    ...transformDataToServer(filters),
  });

  const { mutate: mutateExport, isLoading: isLoadingExport } = useMutation(
    () => postFetcher(`/export/${model}?${exportQueryString}`, {}),
    {
      onSuccess: (data) => {
        fileDownload(data, `${model}.csv`);
        message.success(_t('Successfully exported'));
      },
      onError: () => {
        message.error(_t('Server error'));
      },
    }
  );

  const { mutate: mutateDelete } = useMutation(
    (id: string) => deleteFetcher(`/delete/${model}/${id}`),
    {
      onSuccess: () => {
        message.success(_t('Successfully deleted'));
        queryClient.invalidateQueries([`/list/${model}`]);
        setPage(DEFAULT_PAGE);
        setPageSize(DEFAULT_PAGE_SIZE);
        setFilters({});
      },
      onError: () => {
        message.error(_t('Server error'));
      },
    }
  );

  const onTableChange = (pagination: any, tableFilters: any, sorter: any): void => {
    if (pagination.pageSize !== pageSize) {
      setPage(1);
    } else {
      setPage(pagination.current);
    }
    setPageSize(pagination.pageSize);
    setSortBy(sorter.order === 'ascend' ? sorter.field : `-${sorter.field}`);
  };

  return (
    <CrudContainer
      title={modelConfiguration?.name || model || ''}
      breadcrumbs={
        <Breadcrumb>
          <Breadcrumb.Item>
            <Link to="/">{_t('Dashboard')}</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>{model}</Breadcrumb.Item>
        </Breadcrumb>
      }
      actions={
        <Row style={{ marginTop: 10, marginBottom: 10 }} gutter={[8, 8]}>
          <Col>
            <Input.Search
              placeholder={modelConfiguration?.search_help_text || (_t('Search By') as string)}
              allowClear
              onSearch={setSearch}
              style={{ width: 200 }}
            />
          </Col>
          {modelConfiguration?.permissions?.includes(EModelPermission.Export) && (
            <Col>
              <Button loading={isLoadingExport} onClick={() => mutateExport()}>
                <DownloadOutlined /> {_t('Export CSV')}
              </Button>
            </Col>
          )}
          {modelConfiguration?.permissions?.includes(EModelPermission.Add) && (
            <Col>
              <Button onClick={() => navigate(`/add/${model}`)}>
                <PlusCircleOutlined /> {_t('Add')}
              </Button>
            </Col>
          )}
        </Row>
      }
    >
      {modelConfiguration ? (
        <TableOrCards
          loading={isLoading}
          columns={[
            ...columns,
            {
              title: _t('Actions'),
              dataIndex: 'id',
              key: 'actions',
              width: 100,
              fixed: 'right',
              render: (id: string) => {
                return (
                  <Space>
                    {modelConfiguration.permissions.includes(EModelPermission.Delete) && (
                      <Popconfirm title={_t('Are you sure?')} onConfirm={() => mutateDelete(id)}>
                        <Button size="small" danger>
                          <DeleteOutlined />
                        </Button>
                      </Popconfirm>
                    )}
                    {modelConfiguration.permissions.includes(EModelPermission.Change) && (
                      <Button size="small" onClick={() => navigate(`/change/${model}/${id}`)}>
                        <EditOutlined />
                      </Button>
                    )}
                  </Space>
                );
              },
            },
          ]}
          onChange={onTableChange}
          rowKey={'id'}
          dataSource={data?.results || []}
          pagination={{
            current: page,
            pageSize,
            total: data?.total,
            showSizeChanger: true,
          }}
        />
      ) : (
        <Empty description={_t('No permissions for model')} />
      )}
    </CrudContainer>
  );
};