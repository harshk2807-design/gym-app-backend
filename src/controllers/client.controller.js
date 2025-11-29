import supabase from '../config/supabase.js';

export const getAllClients = async (req, res) => {
  try {
    const { status, search, plan_type } = req.query;

    let query = supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (plan_type) {
      query = query.eq('plan_type', plan_type);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: clients, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: clients,
      count: clients.length,
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients',
    });
  }
};

export const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    // Get payment history
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('client_id', id)
      .order('payment_date', { ascending: false });

    // Get history
    const { data: history } = await supabase
      .from('client_history')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false });

    res.json({
      success: true,
      data: {
        ...client,
        payments: payments || [],
        history: history || [],
      },
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client',
    });
  }
};

export const createClient = async (req, res) => {
  try {
    const clientData = req.body;

    // Calculate end date based on plan type
    const startDate = new Date(clientData.start_date);
    let endDate = new Date(startDate);

    switch (clientData.plan_type) {
      case 'Monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'Quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'Yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    clientData.end_date = endDate.toISOString().split('T')[0];

    // Insert client
    const { data: client, error } = await supabase
      .from('clients')
      .insert([clientData])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Add payment record
    await supabase.from('payments').insert([
      {
        client_id: client.id,
        amount: clientData.plan_amount,
        payment_date: clientData.start_date,
        payment_method: 'Cash',
        notes: 'Initial payment',
      },
    ]);

    // Add history
    await supabase.from('client_history').insert([
      {
        client_id: client.id,
        action_type: 'CREATED',
        description: `Client account created with ${clientData.plan_type} plan`,
      },
    ]);

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: client,
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create client',
    });
  }
};

export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.created_at;

    const { data: client, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Add history
    await supabase.from('client_history').insert([
      {
        client_id: id,
        action_type: 'UPDATED',
        description: 'Client information updated',
      },
    ]);

    res.json({
      success: true,
      message: 'Client updated successfully',
      data: client,
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update client',
    });
  }
};

export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from('clients').delete().eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Client deleted successfully',
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete client',
    });
  }
};

export const renewPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan_type, plan_amount, payment_method } = req.body;

    // Get current client
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    // Calculate new dates
    const startDate = new Date();
    let endDate = new Date(startDate);

    switch (plan_type) {
      case 'Monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'Quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'Yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    // Update client
    const { data: updatedClient, error } = await supabase
      .from('clients')
      .update({
        plan_type,
        plan_amount,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'Active',
        payment_status: 'Paid',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Add payment record
    await supabase.from('payments').insert([
      {
        client_id: id,
        amount: plan_amount,
        payment_date: startDate.toISOString().split('T')[0],
        payment_method: payment_method || 'Cash',
        notes: 'Plan renewal',
      },
    ]);

    // Add history
    await supabase.from('client_history').insert([
      {
        client_id: id,
        action_type: 'RENEWED',
        description: `Plan renewed: ${plan_type}`,
      },
    ]);

    res.json({
      success: true,
      message: 'Plan renewed successfully',
      data: updatedClient,
    });
  } catch (error) {
    console.error('Renew plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to renew plan',
    });
  }
};

export const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const paymentData = req.body;

    const { data: payment, error } = await supabase
      .from('payments')
      .insert([
        {
          client_id: id,
          ...paymentData,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update client payment status
    await supabase
      .from('clients')
      .update({ payment_status: 'Paid' })
      .eq('id', id);

    // Add history
    await supabase.from('client_history').insert([
      {
        client_id: id,
        action_type: 'PAYMENT',
        description: `Payment received: ₹${paymentData.amount}`,
      },
    ]);

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment,
    });
  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
    });
  }
};
export const bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client IDs',
      });
    }

    const { error } = await supabase
      .from('clients')
      .delete()
      .in('id', ids);

    if (error) throw error;

    res.json({
      success: true,
      message: `${ids.length} clients deleted successfully`,
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete clients',
    });
  }
};
