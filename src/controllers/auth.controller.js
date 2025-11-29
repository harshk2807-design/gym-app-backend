import bcrypt from 'bcryptjs';
import supabase from '../config/supabase.js';
import { generateToken } from '../utils/jwt.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find admin by email
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: admin.id,
      email: admin.email,
      full_name: admin.full_name,
    });

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          full_name: admin.full_name,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

export const register = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    // Validate input
    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Check if admin already exists
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('id')
      .eq('email', email)
      .single();

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists',
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create new admin
    const { data: newAdmin, error } = await supabase
      .from('admins')
      .insert([{ email, password_hash, full_name }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Generate token
    const token = generateToken({
      id: newAdmin.id,
      email: newAdmin.email,
      full_name: newAdmin.full_name,
    });

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: {
        token,
        admin: {
          id: newAdmin.id,
          email: newAdmin.email,
          full_name: newAdmin.full_name,
        },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, email, full_name, created_at')
      .eq('id', req.admin.id)
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: admin,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
    });
  }
};
