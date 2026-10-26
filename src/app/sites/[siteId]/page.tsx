import DashboardWorkspace from '@/components/dashboard-workspace';
export default async function SiteDashboard({params}:{params:Promise<{siteId:string}>}){const {siteId}=await params;return <DashboardWorkspace siteId={siteId}/>;}
