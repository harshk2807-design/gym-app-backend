import supabase from '../config/supabase.js';

export const getDashboardStats = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.toISOString().split('T')[0].substring(0, 7); // YYYY-MM

    // Run queries in parallel for better performance
    const [
      { count: totalClients },
      { count: activeClients },
      { count: expiredClients },
      { data: monthlyPayments },
      { data: recentClients }
    ] = await Promise.all([
      // Total clients
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      
      // Active clients
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
      
      // Expired clients
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'Expired'),
      
      // Current month payments
      supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', `${currentMonth}-01`)
        .lte('payment_date', `${currentMonth}-31`),
      
      // Recent clients for activity
      supabase
        .from('clients')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(100)
    ]);

    const monthlyRevenue = monthlyPayments?.reduce(
      (sum, payment) => sum + parseFloat(payment.amount),
      0
    ) || 0;

    // Get revenue for last 6 months (optimized with single query)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: allPayments } = await supabase
      .from('payments')
      .select('amount, payment_date')
      .gte('payment_date', sixMonthsAgo.toISOString().split('T')[0])
      .order('payment_date', { ascending: true });

    // Group by month
    const revenueByMonth = {};
    const clientsByMonth = {};
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().substring(0, 7);
      const monthLabel = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      
      revenueByMonth[monthKey] = { month: monthLabel, revenue: 0 };
      clientsByMonth[monthKey] = { month: monthLabel.split(' ')[0], clients: 0 };
    }

    // Aggregate payments
    allPayments?.forEach(payment => {
      const monthKey = payment.payment_date.substring(0, 7);
      if (revenueByMonth[monthKey]) {
        revenueByMonth[monthKey].revenue += parseFloat(payment.amount);
      }
    });

    // Aggregate clients
    recentClients?.forEach(client => {
      const monthKey = client.created_at.substring(0, 7);
      if (clientsByMonth[monthKey]) {
        clientsByMonth[monthKey].clients += 1;
      }
    });

    const revenueData = Object.values(revenueByMonth);
    const clientGrowthData = Object.values(clientsByMonth);

    // Get plan distribution
    const { data: activePlans } = await supabase
      .from('clients')
      .select('plan_type')
      .eq('status', 'Active');

    const planCounts = { Monthly: 0, Quarterly: 0, Yearly: 0 };
    activePlans?.forEach((client) => {
      if (planCounts.hasOwnProperty(client.plan_type)) {
        planCounts[client.plan_type]++;
      }
    });

    const planDistributionData = Object.entries(planCounts).map(([name, value]) => ({
      name,
      value,
    }));

    res.json({
      success: true,
      data: {
        stats: {
          totalClients,
          activeClients,
          expiredClients,
          monthlyRevenue: monthlyRevenue.toFixed(2),
        },
        revenueData,
        clientGrowthData,
        planDistributionData,
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
    });
  }
};
export const getNotifications = async (req, res) => {
  try {
    const notifications = [];
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Get clients expired in last 7 days
    const { data: recentlyExpired } = await supabase
      .from('clients')
      .select('*')
      .eq('status', 'Expired')
      .gte('end_date', sevenDaysAgo.toISOString().split('T')[0])
      .lte('end_date', today.toISOString().split('T')[0])
      .order('end_date', { ascending: false });

    // Get clients expiring in next 7 days
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const { data: expiringSoon } = await supabase
      .from('clients')
      .select('*')
      .eq('status', 'Active')
      .gte('end_date', today.toISOString().split('T')[0])
      .lte('end_date', sevenDaysFromNow.toISOString().split('T')[0])
      .order('end_date', { ascending: true });

    // Format notifications for recently expired
    recentlyExpired?.forEach(client => {
      const daysAgo = Math.floor((today - new Date(client.end_date)) / (1000 * 60 * 60 * 24));
      notifications.push({
        id: `expired-${client.id}`,
        type: 'expired',
        title: 'Membership Expired',
        message: `${client.full_name}'s membership expired ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`,
        client: {
          id: client.id,
          name: client.full_name,
          email: client.email,
          phone: client.phone,
        },
        date: client.end_date,
        read: false,
      });
    });

    // Format notifications for expiring soon
    expiringSoon?.forEach(client => {
      const daysLeft = Math.ceil((new Date(client.end_date) - today) / (1000 * 60 * 60 * 24));
      notifications.push({
        id: `expiring-${client.id}`,
        type: 'expiring',
        title: 'Membership Expiring Soon',
        message: `${client.full_name}'s membership expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
        client: {
          id: client.id,
          name: client.full_name,
          email: client.email,
          phone: client.phone,
        },
        date: client.end_date,
        read: false,
      });
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount: notifications.length,
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
    });
  }
};
