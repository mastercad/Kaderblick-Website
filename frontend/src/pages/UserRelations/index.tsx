import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Tab, Tabs } from '@mui/material';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import { AdminPageLayout } from '../../components/AdminPageLayout';
import UsersTab            from './UsersTab';
import RequestsTab         from './RequestsTab';
import SupporterRequestsTab from './SupporterRequestsTab';
import { RequestCounts }   from './types';

const UserRelations: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const resolveTab = (tab: string | null) => {
    if (tab === 'requests') return 1;
    if (tab === 'supporter-requests') return 2;
    return 0;
  };

  const [activeTab, setActiveTab] = useState(() => resolveTab(searchParams.get('tab')));
  const [requestCounts, setRequestCounts] = useState<RequestCounts>({ pending: 0, approved: 0, rejected: 0 });
  const [supporterRequestCounts, setSupporterRequestCounts] = useState<RequestCounts>({ pending: 0, approved: 0, rejected: 0 });

  React.useEffect(() => {
    setActiveTab(resolveTab(searchParams.get('tab')));
  }, [searchParams]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    if (newValue === 1) {
      setSearchParams({ tab: 'requests' }, { replace: true });
      return;
    }
    if (newValue === 2) {
      setSearchParams({ tab: 'supporter-requests' }, { replace: true });
      return;
    }
    setSearchParams({}, { replace: true });
  };

  const tabs = (
    <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tab label="Benutzer & Zuordnungen" />
      <Tab
        label={
          <Badge
            badgeContent={requestCounts.pending}
            color="error"
            sx={{ pr: requestCounts.pending > 0 ? 1.5 : 0 }}
          >
            Registrierungsanfragen
          </Badge>
        }
      />
      <Tab
        label={
          <Badge
            badgeContent={supporterRequestCounts.pending}
            color="error"
            sx={{ pr: supporterRequestCounts.pending > 0 ? 1.5 : 0 }}
          >
            Supporter-Anfragen
          </Badge>
        }
      />
    </Tabs>
  );

  return (
    <AdminPageLayout
      icon={<ManageAccountsIcon />}
      title="Benutzer-Zuordnungen"
      loading={false}
      maxWidth={1300}
      filterControls={tabs}
    >
      {activeTab === 0 && <UsersTab />}
      {activeTab === 1 && <RequestsTab onCountsChange={setRequestCounts} />}
      {activeTab === 2 && <SupporterRequestsTab onCountsChange={setSupporterRequestCounts} />}
    </AdminPageLayout>
  );
};

export default UserRelations;
