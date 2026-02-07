import type { Rep, Store, Task, Order, Product } from '@opensalesai/shared';
import {
  SkillTier,
  RepRole,
  StoreChannel,
  MslTier,
  TaskType,
  TaskStatus,
  TaskPriority,
  TaskSource,
  OrderSource,
  OrderStatus,
  PaymentStatus,
  ProductCategory,
  ProductUnit,
} from '@opensalesai/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPANY_ID = 'c0000000-0000-0000-0000-000000000001';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

function uid(prefix: string, index: number): string {
  const hex = index.toString(16).padStart(12, '0');
  return `${prefix}-0000-0000-0000-${hex}`;
}

// ---------------------------------------------------------------------------
// mockReps -- 10 sales reps with Indian names across 5 territories
// ---------------------------------------------------------------------------

export const mockReps: Rep[] = [
  {
    id: uid('rep', 1), company_id: COMPANY_ID, employee_code: 'EMP-001', user_id: uid('usr', 1),
    name: 'Rajesh Kumar', email: 'rajesh.kumar@opensalesai.com', phone: '+919876543201',
    role: RepRole.SALES_REP, skill_tier: SkillTier.SENIOR, territory_id: 'territory-mumbai',
    manager_id: null, points_balance: 2450, total_points_earned: 8900, is_active: true,
    last_active_at: hoursAgo(1), device_token: null, current_lat: 19.076, current_lng: 72.8777,
    created_at: daysAgo(180), updated_at: hoursAgo(1), deleted_at: null,
  },
  {
    id: uid('rep', 2), company_id: COMPANY_ID, employee_code: 'EMP-002', user_id: uid('usr', 2),
    name: 'Priya Sharma', email: 'priya.sharma@opensalesai.com', phone: '+919876543202',
    role: RepRole.SALES_REP, skill_tier: SkillTier.EXPERT, territory_id: 'territory-delhi',
    manager_id: null, points_balance: 3100, total_points_earned: 12400, is_active: true,
    last_active_at: hoursAgo(2), device_token: null, current_lat: 28.6139, current_lng: 77.209,
    created_at: daysAgo(365), updated_at: hoursAgo(2), deleted_at: null,
  },
  {
    id: uid('rep', 3), company_id: COMPANY_ID, employee_code: 'EMP-003', user_id: uid('usr', 3),
    name: 'Amit Patel', email: 'amit.patel@opensalesai.com', phone: '+919876543203',
    role: RepRole.SALES_REP, skill_tier: SkillTier.INTERMEDIATE, territory_id: 'territory-bangalore',
    manager_id: null, points_balance: 1800, total_points_earned: 6200, is_active: true,
    last_active_at: hoursAgo(3), device_token: null, current_lat: 12.9716, current_lng: 77.5946,
    created_at: daysAgo(120), updated_at: hoursAgo(3), deleted_at: null,
  },
  {
    id: uid('rep', 4), company_id: COMPANY_ID, employee_code: 'EMP-004', user_id: uid('usr', 4),
    name: 'Sunita Verma', email: 'sunita.verma@opensalesai.com', phone: '+919876543204',
    role: RepRole.SALES_REP, skill_tier: SkillTier.JUNIOR, territory_id: 'territory-chennai',
    manager_id: null, points_balance: 950, total_points_earned: 3100, is_active: true,
    last_active_at: hoursAgo(5), device_token: null, current_lat: 13.0827, current_lng: 80.2707,
    created_at: daysAgo(90), updated_at: hoursAgo(5), deleted_at: null,
  },
  {
    id: uid('rep', 5), company_id: COMPANY_ID, employee_code: 'EMP-005', user_id: uid('usr', 5),
    name: 'Vikram Singh', email: 'vikram.singh@opensalesai.com', phone: '+919876543205',
    role: RepRole.SALES_REP, skill_tier: SkillTier.SENIOR, territory_id: 'territory-kolkata',
    manager_id: null, points_balance: 2100, total_points_earned: 7800, is_active: true,
    last_active_at: hoursAgo(1), device_token: null, current_lat: 22.5726, current_lng: 88.3639,
    created_at: daysAgo(200), updated_at: hoursAgo(1), deleted_at: null,
  },
  {
    id: uid('rep', 6), company_id: COMPANY_ID, employee_code: 'EMP-006', user_id: uid('usr', 6),
    name: 'Deepa Nair', email: 'deepa.nair@opensalesai.com', phone: '+919876543206',
    role: RepRole.SALES_REP, skill_tier: SkillTier.INTERMEDIATE, territory_id: 'territory-mumbai',
    manager_id: null, points_balance: 1650, total_points_earned: 5400, is_active: true,
    last_active_at: hoursAgo(4), device_token: null, current_lat: 19.0178, current_lng: 72.8478,
    created_at: daysAgo(150), updated_at: hoursAgo(4), deleted_at: null,
  },
  {
    id: uid('rep', 7), company_id: COMPANY_ID, employee_code: 'EMP-007', user_id: uid('usr', 7),
    name: 'Arjun Reddy', email: 'arjun.reddy@opensalesai.com', phone: '+919876543207',
    role: RepRole.SALES_REP, skill_tier: SkillTier.TRAINEE, territory_id: 'territory-bangalore',
    manager_id: null, points_balance: 420, total_points_earned: 1200, is_active: true,
    last_active_at: hoursAgo(6), device_token: null, current_lat: 12.9352, current_lng: 77.6245,
    created_at: daysAgo(45), updated_at: hoursAgo(6), deleted_at: null,
  },
  {
    id: uid('rep', 8), company_id: COMPANY_ID, employee_code: 'EMP-008', user_id: uid('usr', 8),
    name: 'Meena Iyer', email: 'meena.iyer@opensalesai.com', phone: '+919876543208',
    role: RepRole.TEAM_LEAD, skill_tier: SkillTier.EXPERT, territory_id: 'territory-chennai',
    manager_id: null, points_balance: 3800, total_points_earned: 15200, is_active: true,
    last_active_at: hoursAgo(2), device_token: null, current_lat: 13.0524, current_lng: 80.2508,
    created_at: daysAgo(400), updated_at: hoursAgo(2), deleted_at: null,
  },
  {
    id: uid('rep', 9), company_id: COMPANY_ID, employee_code: 'EMP-009', user_id: uid('usr', 9),
    name: 'Rahul Gupta', email: 'rahul.gupta@opensalesai.com', phone: '+919876543209',
    role: RepRole.SALES_REP, skill_tier: SkillTier.INTERMEDIATE, territory_id: 'territory-delhi',
    manager_id: null, points_balance: 1900, total_points_earned: 6800, is_active: true,
    last_active_at: hoursAgo(3), device_token: null, current_lat: 28.6353, current_lng: 77.225,
    created_at: daysAgo(160), updated_at: hoursAgo(3), deleted_at: null,
  },
  {
    id: uid('rep', 10), company_id: COMPANY_ID, employee_code: 'EMP-010', user_id: uid('usr', 10),
    name: 'Kavita Das', email: 'kavita.das@opensalesai.com', phone: '+919876543210',
    role: RepRole.SALES_REP, skill_tier: SkillTier.JUNIOR, territory_id: 'territory-kolkata',
    manager_id: null, points_balance: 780, total_points_earned: 2600, is_active: false,
    last_active_at: daysAgo(5), device_token: null, current_lat: 22.5448, current_lng: 88.3426,
    created_at: daysAgo(100), updated_at: daysAgo(5), deleted_at: null,
  },
];

// ---------------------------------------------------------------------------
// mockStores -- 20 stores across Indian cities
// ---------------------------------------------------------------------------

export const mockStores: Store[] = [
  { id: uid('sto', 1), company_id: COMPANY_ID, store_code: 'STR-001', name: 'Sharma General Store', owner_name: 'Ramesh Sharma', phone: '+919800000001', email: null, address_line1: '12 MG Road', address_line2: 'Andheri West', city: 'Mumbai', state: 'Maharashtra', pincode: '400058', lat: 19.1368, lng: 72.8266, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.GOLD, territory_id: 'territory-mumbai', credit_tier: 'A', credit_limit: 100000, outstanding_balance: 12500, is_active: true, last_order_date: daysAgo(2), last_visit_date: daysAgo(1), avg_order_value: 8500, visit_frequency_days: 3, created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('sto', 2), company_id: COMPANY_ID, store_code: 'STR-002', name: 'Patel Kirana', owner_name: 'Jayesh Patel', phone: '+919800000002', email: null, address_line1: '45 Linking Road', address_line2: 'Bandra', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', lat: 19.0596, lng: 72.8295, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.SILVER, territory_id: 'territory-mumbai', credit_tier: 'B', credit_limit: 75000, outstanding_balance: 8200, is_active: true, last_order_date: daysAgo(5), last_visit_date: daysAgo(3), avg_order_value: 5200, visit_frequency_days: 5, created_at: daysAgo(300), updated_at: daysAgo(3), deleted_at: null },
  { id: uid('sto', 3), company_id: COMPANY_ID, store_code: 'STR-003', name: 'Kumar Provision Store', owner_name: 'Suresh Kumar', phone: '+919800000003', email: null, address_line1: '78 Nehru Place', address_line2: null, city: 'Delhi', state: 'Delhi', pincode: '110019', lat: 28.5491, lng: 77.2533, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.PLATINUM, territory_id: 'territory-delhi', credit_tier: 'A', credit_limit: 150000, outstanding_balance: 22000, is_active: true, last_order_date: daysAgo(1), last_visit_date: daysAgo(1), avg_order_value: 12800, visit_frequency_days: 2, created_at: daysAgo(500), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('sto', 4), company_id: COMPANY_ID, store_code: 'STR-004', name: 'Singh Grocery Mart', owner_name: 'Harpreet Singh', phone: '+919800000004', email: null, address_line1: '23 Connaught Place', address_line2: 'Block B', city: 'Delhi', state: 'Delhi', pincode: '110001', lat: 28.6315, lng: 77.2167, channel: StoreChannel.SUPERMARKET, msl_tier: MslTier.GOLD, territory_id: 'territory-delhi', credit_tier: 'A', credit_limit: 120000, outstanding_balance: 15600, is_active: true, last_order_date: daysAgo(3), last_visit_date: daysAgo(2), avg_order_value: 9800, visit_frequency_days: 3, created_at: daysAgo(400), updated_at: daysAgo(2), deleted_at: null },
  { id: uid('sto', 5), company_id: COMPANY_ID, store_code: 'STR-005', name: 'Reddy Supermart', owner_name: 'Venkat Reddy', phone: '+919800000005', email: null, address_line1: '56 Brigade Road', address_line2: null, city: 'Bangalore', state: 'Karnataka', pincode: '560001', lat: 12.9716, lng: 77.6089, channel: StoreChannel.SUPERMARKET, msl_tier: MslTier.PLATINUM, territory_id: 'territory-bangalore', credit_tier: 'A', credit_limit: 200000, outstanding_balance: 30000, is_active: true, last_order_date: daysAgo(1), last_visit_date: daysAgo(1), avg_order_value: 15600, visit_frequency_days: 2, created_at: daysAgo(450), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('sto', 6), company_id: COMPANY_ID, store_code: 'STR-006', name: 'Lakshmi Stores', owner_name: 'Lakshmi Devi', phone: '+919800000006', email: null, address_line1: '89 Anna Nagar', address_line2: '2nd Street', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040', lat: 13.0878, lng: 80.2101, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.GOLD, territory_id: 'territory-chennai', credit_tier: 'B', credit_limit: 80000, outstanding_balance: 9800, is_active: true, last_order_date: daysAgo(4), last_visit_date: daysAgo(2), avg_order_value: 6200, visit_frequency_days: 4, created_at: daysAgo(280), updated_at: daysAgo(2), deleted_at: null },
  { id: uid('sto', 7), company_id: COMPANY_ID, store_code: 'STR-007', name: 'Bose Traders', owner_name: 'Subhas Bose', phone: '+919800000007', email: null, address_line1: '34 Park Street', address_line2: null, city: 'Kolkata', state: 'West Bengal', pincode: '700016', lat: 22.5525, lng: 88.3528, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.SILVER, territory_id: 'territory-kolkata', credit_tier: 'B', credit_limit: 60000, outstanding_balance: 4500, is_active: true, last_order_date: daysAgo(6), last_visit_date: daysAgo(4), avg_order_value: 4800, visit_frequency_days: 5, created_at: daysAgo(220), updated_at: daysAgo(4), deleted_at: null },
  { id: uid('sto', 8), company_id: COMPANY_ID, store_code: 'STR-008', name: 'Joshi Medical & General', owner_name: 'Prakash Joshi', phone: '+919800000008', email: null, address_line1: '67 FC Road', address_line2: null, city: 'Mumbai', state: 'Maharashtra', pincode: '400004', lat: 19.007, lng: 72.829, channel: StoreChannel.CHEMIST, msl_tier: MslTier.BRONZE, territory_id: 'territory-mumbai', credit_tier: 'C', credit_limit: 40000, outstanding_balance: 18000, is_active: true, last_order_date: daysAgo(14), last_visit_date: daysAgo(8), avg_order_value: 3200, visit_frequency_days: 7, created_at: daysAgo(180), updated_at: daysAgo(8), deleted_at: null },
  { id: uid('sto', 9), company_id: COMPANY_ID, store_code: 'STR-009', name: 'New Delhi Mart', owner_name: 'Mohd Iqbal', phone: '+919800000009', email: null, address_line1: '12 Chandni Chowk', address_line2: null, city: 'Delhi', state: 'Delhi', pincode: '110006', lat: 28.6507, lng: 77.2334, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.GOLD, territory_id: 'territory-delhi', credit_tier: 'A', credit_limit: 100000, outstanding_balance: 5400, is_active: true, last_order_date: daysAgo(2), last_visit_date: daysAgo(1), avg_order_value: 11200, visit_frequency_days: 3, created_at: daysAgo(350), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('sto', 10), company_id: COMPANY_ID, store_code: 'STR-010', name: 'Gowda Provisions', owner_name: 'Raju Gowda', phone: '+919800000010', email: null, address_line1: '23 Jayanagar 4th Block', address_line2: null, city: 'Bangalore', state: 'Karnataka', pincode: '560041', lat: 12.9279, lng: 77.5838, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.SILVER, territory_id: 'territory-bangalore', credit_tier: 'B', credit_limit: 70000, outstanding_balance: 11000, is_active: true, last_order_date: daysAgo(3), last_visit_date: daysAgo(2), avg_order_value: 5800, visit_frequency_days: 4, created_at: daysAgo(260), updated_at: daysAgo(2), deleted_at: null },
  { id: uid('sto', 11), company_id: COMPANY_ID, store_code: 'STR-011', name: 'Murugan Stores', owner_name: 'Murugan S', phone: '+919800000011', email: null, address_line1: '45 T. Nagar', address_line2: null, city: 'Chennai', state: 'Tamil Nadu', pincode: '600017', lat: 13.0418, lng: 80.2341, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.GOLD, territory_id: 'territory-chennai', credit_tier: 'A', credit_limit: 90000, outstanding_balance: 7800, is_active: true, last_order_date: daysAgo(1), last_visit_date: daysAgo(1), avg_order_value: 7400, visit_frequency_days: 3, created_at: daysAgo(310), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('sto', 12), company_id: COMPANY_ID, store_code: 'STR-012', name: 'Chatterjee & Sons', owner_name: 'Anil Chatterjee', phone: '+919800000012', email: null, address_line1: '78 Salt Lake Sector 5', address_line2: null, city: 'Kolkata', state: 'West Bengal', pincode: '700091', lat: 22.5772, lng: 88.4152, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.SILVER, territory_id: 'territory-kolkata', credit_tier: 'B', credit_limit: 55000, outstanding_balance: 3200, is_active: true, last_order_date: daysAgo(7), last_visit_date: daysAgo(5), avg_order_value: 4200, visit_frequency_days: 6, created_at: daysAgo(200), updated_at: daysAgo(5), deleted_at: null },
  { id: uid('sto', 13), company_id: COMPANY_ID, store_code: 'STR-013', name: 'Gupta Pan Corner', owner_name: 'Ravi Gupta', phone: '+919800000013', email: null, address_line1: '9 Karol Bagh', address_line2: null, city: 'Delhi', state: 'Delhi', pincode: '110005', lat: 28.6519, lng: 77.1907, channel: StoreChannel.PAN_SHOP, msl_tier: MslTier.BRONZE, territory_id: 'territory-delhi', credit_tier: 'C', credit_limit: 25000, outstanding_balance: 8900, is_active: true, last_order_date: daysAgo(10), last_visit_date: daysAgo(7), avg_order_value: 2100, visit_frequency_days: 7, created_at: daysAgo(150), updated_at: daysAgo(7), deleted_at: null },
  { id: uid('sto', 14), company_id: COMPANY_ID, store_code: 'STR-014', name: 'Rao Supermarket', owner_name: 'Narasimha Rao', phone: '+919800000014', email: null, address_line1: '112 Koramangala', address_line2: '5th Block', city: 'Bangalore', state: 'Karnataka', pincode: '560095', lat: 12.9352, lng: 77.6245, channel: StoreChannel.SUPERMARKET, msl_tier: MslTier.GOLD, territory_id: 'territory-bangalore', credit_tier: 'A', credit_limit: 130000, outstanding_balance: 18500, is_active: true, last_order_date: daysAgo(2), last_visit_date: daysAgo(1), avg_order_value: 10500, visit_frequency_days: 3, created_at: daysAgo(380), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('sto', 15), company_id: COMPANY_ID, store_code: 'STR-015', name: 'Anand Sweets & Grocery', owner_name: 'Anand Mehta', phone: '+919800000015', email: null, address_line1: '34 Dadar TT Circle', address_line2: null, city: 'Mumbai', state: 'Maharashtra', pincode: '400014', lat: 19.0176, lng: 72.8451, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.GOLD, territory_id: 'territory-mumbai', credit_tier: 'A', credit_limit: 110000, outstanding_balance: 6700, is_active: true, last_order_date: daysAgo(1), last_visit_date: daysAgo(1), avg_order_value: 9200, visit_frequency_days: 3, created_at: daysAgo(340), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('sto', 16), company_id: COMPANY_ID, store_code: 'STR-016', name: 'Pillai Convenience', owner_name: 'Thomas Pillai', phone: '+919800000016', email: null, address_line1: '56 Adyar', address_line2: null, city: 'Chennai', state: 'Tamil Nadu', pincode: '600020', lat: 13.0067, lng: 80.2562, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.SILVER, territory_id: 'territory-chennai', credit_tier: 'B', credit_limit: 65000, outstanding_balance: 4100, is_active: true, last_order_date: daysAgo(5), last_visit_date: daysAgo(3), avg_order_value: 4600, visit_frequency_days: 5, created_at: daysAgo(240), updated_at: daysAgo(3), deleted_at: null },
  { id: uid('sto', 17), company_id: COMPANY_ID, store_code: 'STR-017', name: 'Roy General Store', owner_name: 'Dipak Roy', phone: '+919800000017', email: null, address_line1: '67 Gariahat', address_line2: null, city: 'Kolkata', state: 'West Bengal', pincode: '700019', lat: 22.5179, lng: 88.3665, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.BRONZE, territory_id: 'territory-kolkata', credit_tier: 'C', credit_limit: 35000, outstanding_balance: 12800, is_active: true, last_order_date: daysAgo(12), last_visit_date: daysAgo(9), avg_order_value: 3400, visit_frequency_days: 7, created_at: daysAgo(170), updated_at: daysAgo(9), deleted_at: null },
  { id: uid('sto', 18), company_id: COMPANY_ID, store_code: 'STR-018', name: 'Metro Fresh Mart', owner_name: 'Kiran Desai', phone: '+919800000018', email: null, address_line1: '101 Powai', address_line2: 'Hiranandani Complex', city: 'Mumbai', state: 'Maharashtra', pincode: '400076', lat: 19.1176, lng: 72.9071, channel: StoreChannel.MODERN_TRADE, msl_tier: MslTier.PLATINUM, territory_id: 'territory-mumbai', credit_tier: 'A', credit_limit: 250000, outstanding_balance: 42000, is_active: true, last_order_date: daysAgo(1), last_visit_date: daysAgo(1), avg_order_value: 24500, visit_frequency_days: 2, created_at: daysAgo(420), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('sto', 19), company_id: COMPANY_ID, store_code: 'STR-019', name: 'Sai Ram Traders', owner_name: 'Sai Prasad', phone: '+919800000019', email: null, address_line1: '88 Whitefield', address_line2: null, city: 'Bangalore', state: 'Karnataka', pincode: '560066', lat: 12.9698, lng: 77.7500, channel: StoreChannel.GENERAL_TRADE, msl_tier: MslTier.SILVER, territory_id: 'territory-bangalore', credit_tier: 'B', credit_limit: 70000, outstanding_balance: 5600, is_active: true, last_order_date: daysAgo(4), last_visit_date: daysAgo(3), avg_order_value: 5500, visit_frequency_days: 4, created_at: daysAgo(190), updated_at: daysAgo(3), deleted_at: null },
  { id: uid('sto', 20), company_id: COMPANY_ID, store_code: 'STR-020', name: 'Thakur Hotel Supplies', owner_name: 'Rajendra Thakur', phone: '+919800000020', email: null, address_line1: '45 Juhu Beach Road', address_line2: null, city: 'Mumbai', state: 'Maharashtra', pincode: '400049', lat: 19.0883, lng: 72.8262, channel: StoreChannel.HORECA, msl_tier: MslTier.GOLD, territory_id: 'territory-mumbai', credit_tier: 'A', credit_limit: 180000, outstanding_balance: 28000, is_active: true, last_order_date: daysAgo(2), last_visit_date: daysAgo(1), avg_order_value: 18500, visit_frequency_days: 3, created_at: daysAgo(300), updated_at: daysAgo(1), deleted_at: null },
];

// ---------------------------------------------------------------------------
// mockProducts -- 20 products (Indian CPG brands)
// ---------------------------------------------------------------------------

export const mockProducts: Product[] = [
  { id: uid('prd', 1), company_id: COMPANY_ID, sku_code: 'BEV-CC-300', name: 'Coca-Cola 300ml', description: 'Coca-Cola carbonated soft drink 300ml PET bottle', category: ProductCategory.BEVERAGES, sub_category: 'Carbonated', brand: 'Coca-Cola', unit: ProductUnit.CASES, units_per_case: 24, mrp: 20, selling_price: 17, retailer_margin: 15, distributor_margin: 8, weight_grams: 300, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 100, current_stock: 450, reorder_level: 100, lead_time_days: 2, created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('prd', 2), company_id: COMPANY_ID, sku_code: 'BEV-TU-250', name: 'Thums Up 250ml', description: 'Thums Up strong carbonated cola 250ml glass bottle', category: ProductCategory.BEVERAGES, sub_category: 'Carbonated', brand: 'Thums Up', unit: ProductUnit.CASES, units_per_case: 24, mrp: 15, selling_price: 13, retailer_margin: 13, distributor_margin: 7, weight_grams: 250, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 100, current_stock: 380, reorder_level: 80, lead_time_days: 2, created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('prd', 3), company_id: COMPANY_ID, sku_code: 'SNK-LAYS-52', name: 'Lays Classic Salted 52g', description: 'Lays potato chips classic salted flavor 52g pack', category: ProductCategory.SNACKS, sub_category: 'Chips', brand: 'Lays', unit: ProductUnit.PACKS, units_per_case: 48, mrp: 20, selling_price: 17, retailer_margin: 15, distributor_margin: 8, weight_grams: 52, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 200, current_stock: 620, reorder_level: 150, lead_time_days: 3, created_at: daysAgo(365), updated_at: daysAgo(2), deleted_at: null },
  { id: uid('prd', 4), company_id: COMPANY_ID, sku_code: 'PKF-MAG-70', name: 'Maggi 2-Minute Noodles 70g', description: 'Maggi masala instant noodles 70g pack', category: ProductCategory.PACKAGED_FOOD, sub_category: 'Instant Noodles', brand: 'Maggi', unit: ProductUnit.PACKS, units_per_case: 48, mrp: 14, selling_price: 12, retailer_margin: 14, distributor_margin: 7, weight_grams: 70, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 300, current_stock: 890, reorder_level: 200, lead_time_days: 2, created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('prd', 5), company_id: COMPANY_ID, sku_code: 'CNF-PLG-82', name: 'Parle-G Glucose Biscuit 82g', description: 'Parle-G original glucose biscuit 82g pack', category: ProductCategory.CONFECTIONERY, sub_category: 'Biscuits', brand: 'Parle-G', unit: ProductUnit.PACKS, units_per_case: 96, mrp: 10, selling_price: 8.5, retailer_margin: 15, distributor_margin: 8, weight_grams: 82, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 500, current_stock: 1200, reorder_level: 300, lead_time_days: 2, created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('prd', 6), company_id: COMPANY_ID, sku_code: 'HC-SRF-1K', name: 'Surf Excel Easy Wash 1kg', description: 'Surf Excel detergent powder 1kg pack', category: ProductCategory.HOME_CARE, sub_category: 'Detergent', brand: 'Surf Excel', unit: ProductUnit.PIECES, units_per_case: 12, mrp: 125, selling_price: 108, retailer_margin: 14, distributor_margin: 7, weight_grams: 1000, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 50, current_stock: 280, reorder_level: 60, lead_time_days: 3, created_at: daysAgo(365), updated_at: daysAgo(2), deleted_at: null },
  { id: uid('prd', 7), company_id: COMPANY_ID, sku_code: 'PC-CLP-175', name: 'Clinic Plus Shampoo 175ml', description: 'Clinic Plus strong & long shampoo 175ml bottle', category: ProductCategory.PERSONAL_CARE, sub_category: 'Shampoo', brand: 'Clinic Plus', unit: ProductUnit.PIECES, units_per_case: 24, mrp: 95, selling_price: 82, retailer_margin: 14, distributor_margin: 7, weight_grams: 175, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 60, current_stock: 340, reorder_level: 80, lead_time_days: 3, created_at: daysAgo(365), updated_at: daysAgo(3), deleted_at: null },
  { id: uid('prd', 8), company_id: COMPANY_ID, sku_code: 'BEV-LIM-350', name: 'Limca 350ml', description: 'Limca lemon-lime carbonated drink 350ml PET', category: ProductCategory.BEVERAGES, sub_category: 'Carbonated', brand: 'Limca', unit: ProductUnit.CASES, units_per_case: 24, mrp: 20, selling_price: 17, retailer_margin: 15, distributor_margin: 8, weight_grams: 350, image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 80, current_stock: 210, reorder_level: 50, lead_time_days: 2, created_at: daysAgo(365), updated_at: daysAgo(2), deleted_at: null },
  { id: uid('prd', 9), company_id: COMPANY_ID, sku_code: 'DAR-AMU-500', name: 'Amul Taaza Milk 500ml', description: 'Amul Taaza toned milk 500ml pouch', category: ProductCategory.DAIRY, sub_category: 'Milk', brand: 'Amul', unit: ProductUnit.PACKS, units_per_case: 20, mrp: 27, selling_price: 25, retailer_margin: 7, distributor_margin: 4, weight_grams: 500, image_url: null, is_active: true, is_msl: true, min_order_qty: 5, max_order_qty: 200, current_stock: 520, reorder_level: 100, lead_time_days: 1, created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('prd', 10), company_id: COMPANY_ID, sku_code: 'SNK-KRK-65', name: 'Kurkure Masala Munch 65g', description: 'Kurkure masala munch corn puffs 65g', category: ProductCategory.SNACKS, sub_category: 'Puffs', brand: 'Kurkure', unit: ProductUnit.PACKS, units_per_case: 48, mrp: 20, selling_price: 17, retailer_margin: 15, distributor_margin: 8, weight_grams: 65, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 200, current_stock: 550, reorder_level: 120, lead_time_days: 3, created_at: daysAgo(365), updated_at: daysAgo(2), deleted_at: null },
  { id: uid('prd', 11), company_id: COMPANY_ID, sku_code: 'PC-DVE-100', name: 'Dove Beauty Bar 100g', description: 'Dove cream beauty bathing bar 100g', category: ProductCategory.PERSONAL_CARE, sub_category: 'Soap', brand: 'Dove', unit: ProductUnit.PIECES, units_per_case: 48, mrp: 55, selling_price: 47, retailer_margin: 15, distributor_margin: 8, weight_grams: 100, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 100, current_stock: 420, reorder_level: 100, lead_time_days: 3, created_at: daysAgo(365), updated_at: daysAgo(3), deleted_at: null },
  { id: uid('prd', 12), company_id: COMPANY_ID, sku_code: 'BEV-MZA-250', name: 'Maaza Mango 250ml', description: 'Maaza mango fruit drink 250ml Tetra Pak', category: ProductCategory.BEVERAGES, sub_category: 'Juice', brand: 'Maaza', unit: ProductUnit.CASES, units_per_case: 24, mrp: 25, selling_price: 21, retailer_margin: 16, distributor_margin: 8, weight_grams: 250, image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 80, current_stock: 190, reorder_level: 40, lead_time_days: 2, created_at: daysAgo(365), updated_at: daysAgo(2), deleted_at: null },
  { id: uid('prd', 13), company_id: COMPANY_ID, sku_code: 'PKF-TAT-1K', name: 'Tata Salt 1kg', description: 'Tata iodized salt 1kg pack', category: ProductCategory.PACKAGED_FOOD, sub_category: 'Salt', brand: 'Tata', unit: ProductUnit.PIECES, units_per_case: 24, mrp: 28, selling_price: 24, retailer_margin: 14, distributor_margin: 7, weight_grams: 1000, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 100, current_stock: 680, reorder_level: 150, lead_time_days: 3, created_at: daysAgo(365), updated_at: daysAgo(4), deleted_at: null },
  { id: uid('prd', 14), company_id: COMPANY_ID, sku_code: 'HC-VIM-500', name: 'Vim Dishwash Liquid 500ml', description: 'Vim lemon dishwash liquid 500ml', category: ProductCategory.HOME_CARE, sub_category: 'Dishwash', brand: 'Vim', unit: ProductUnit.PIECES, units_per_case: 12, mrp: 109, selling_price: 94, retailer_margin: 14, distributor_margin: 7, weight_grams: 500, image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 40, current_stock: 180, reorder_level: 40, lead_time_days: 3, created_at: daysAgo(365), updated_at: daysAgo(3), deleted_at: null },
  { id: uid('prd', 15), company_id: COMPANY_ID, sku_code: 'CNF-5ST-24', name: 'Cadbury 5 Star 24g', description: 'Cadbury 5 Star caramel and nougat chocolate bar 24g', category: ProductCategory.CONFECTIONERY, sub_category: 'Chocolate', brand: 'Cadbury', unit: ProductUnit.PACKS, units_per_case: 60, mrp: 10, selling_price: 8.5, retailer_margin: 15, distributor_margin: 8, weight_grams: 24, image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 200, current_stock: 740, reorder_level: 180, lead_time_days: 3, created_at: daysAgo(365), updated_at: daysAgo(2), deleted_at: null },
  { id: uid('prd', 16), company_id: COMPANY_ID, sku_code: 'BEV-SP-200', name: 'Sprite 200ml', description: 'Sprite clear lime carbonated drink 200ml glass bottle', category: ProductCategory.BEVERAGES, sub_category: 'Carbonated', brand: 'Sprite', unit: ProductUnit.CASES, units_per_case: 24, mrp: 12, selling_price: 10, retailer_margin: 17, distributor_margin: 8, weight_grams: 200, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 100, current_stock: 310, reorder_level: 70, lead_time_days: 2, created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('prd', 17), company_id: COMPANY_ID, sku_code: 'PC-CLG-100', name: 'Colgate MaxFresh 100g', description: 'Colgate MaxFresh cooling crystals toothpaste 100g', category: ProductCategory.PERSONAL_CARE, sub_category: 'Toothpaste', brand: 'Colgate', unit: ProductUnit.PIECES, units_per_case: 36, mrp: 80, selling_price: 69, retailer_margin: 14, distributor_margin: 7, weight_grams: 100, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 80, current_stock: 400, reorder_level: 90, lead_time_days: 3, created_at: daysAgo(365), updated_at: daysAgo(2), deleted_at: null },
  { id: uid('prd', 18), company_id: COMPANY_ID, sku_code: 'DAR-AML-400', name: 'Amul Butter 400g', description: 'Amul pasteurized butter 400g carton', category: ProductCategory.DAIRY, sub_category: 'Butter', brand: 'Amul', unit: ProductUnit.PIECES, units_per_case: 20, mrp: 260, selling_price: 240, retailer_margin: 8, distributor_margin: 5, weight_grams: 400, image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 30, current_stock: 120, reorder_level: 25, lead_time_days: 1, created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('prd', 19), company_id: COMPANY_ID, sku_code: 'PKF-BRT-500', name: 'Britannia Bread 500g', description: 'Britannia premium white bread 500g loaf', category: ProductCategory.PACKAGED_FOOD, sub_category: 'Bread', brand: 'Britannia', unit: ProductUnit.PIECES, units_per_case: 12, mrp: 45, selling_price: 39, retailer_margin: 13, distributor_margin: 7, weight_grams: 500, image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 50, current_stock: 160, reorder_level: 30, lead_time_days: 1, created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null },
  { id: uid('prd', 20), company_id: COMPANY_ID, sku_code: 'HLT-BRN-250', name: 'Bournvita Health Drink 250g', description: 'Cadbury Bournvita chocolate health drink 250g jar', category: ProductCategory.HEALTH, sub_category: 'Health Drink', brand: 'Cadbury', unit: ProductUnit.PIECES, units_per_case: 24, mrp: 145, selling_price: 126, retailer_margin: 13, distributor_margin: 7, weight_grams: 250, image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 50, current_stock: 260, reorder_level: 60, lead_time_days: 3, created_at: daysAgo(365), updated_at: daysAgo(2), deleted_at: null },
];

// ---------------------------------------------------------------------------
// mockTasks -- 30 AI-generated tasks
// ---------------------------------------------------------------------------

const taskTemplates: Array<{
  type: TaskType;
  title: string;
  reasoning: string;
  priority: TaskPriority;
  score: number;
}> = [
  { type: TaskType.VISIT, title: 'Visit Sharma General Store - push Coca-Cola 300ml', reasoning: 'Store has not ordered Coca-Cola in 14 days despite being a Gold-tier outlet. Average weekly consumption is 3 cases. Visit to push 5 cases with a 5% volume discount.', priority: TaskPriority.HIGH, score: 85 },
  { type: TaskType.ORDER, title: 'Collect reorder from Kumar Provision Store', reasoning: 'Predicted stock depletion in 2 days for 4 MSL items based on consumption trends. Store has credit tier A -- suggest bundled reorder of 12 cases total.', priority: TaskPriority.CRITICAL, score: 95 },
  { type: TaskType.COLLECTION, title: 'Payment collection from Patel Kirana', reasoning: 'Outstanding balance of Rs 8,200 is 11% of credit limit. Payment is 5 days overdue. Risk of credit tier downgrade from B to C if not collected this week.', priority: TaskPriority.HIGH, score: 82 },
  { type: TaskType.MERCHANDISING, title: 'Fix shelf display at Reddy Supermart', reasoning: 'Store audit image from last visit shows competitor products occupying allocated brand shelf space. Supermart tier -- high foot traffic. Fix display urgently.', priority: TaskPriority.MEDIUM, score: 70 },
  { type: TaskType.PROMOTION, title: 'Introduce new Lays flavor at Singh Grocery Mart', reasoning: 'Store has high snack category sales (top 10%). New Lays Tomato Twist flavor launching. Offer introductory 2+1 deal for trial placement.', priority: TaskPriority.MEDIUM, score: 68 },
  { type: TaskType.STOCK_CHECK, title: 'Stock audit at Metro Fresh Mart', reasoning: 'Modern trade outlet with high volume. Stock discrepancy detected -- system shows 45 cases of Maggi but last scan reported 28. Potential pilferage or miscounting.', priority: TaskPriority.HIGH, score: 88 },
  { type: TaskType.NEW_OUTLET, title: 'Onboard new grocery store on 4th Main Road', reasoning: 'Detected new grocery store opening in high-density residential area. No competitor coverage yet. Early mover advantage -- onboard with starter kit offer.', priority: TaskPriority.MEDIUM, score: 72 },
  { type: TaskType.COACHING, title: 'Coach Arjun Reddy on upselling techniques', reasoning: 'Trainee rep with lowest average order value in Bangalore territory (Rs 3,200 vs avg Rs 5,800). Focus coaching on bundle selling and promotion pitching.', priority: TaskPriority.LOW, score: 55 },
  { type: TaskType.RELATIONSHIP, title: 'Birthday visit to Lakshmi Devi (Lakshmi Stores)', reasoning: 'Store owner birthday today. High-value Gold-tier account. Personal visit strengthens relationship. Bring complimentary gift hamper worth Rs 500.', priority: TaskPriority.LOW, score: 45 },
  { type: TaskType.SURVEY, title: 'Competitor pricing survey in Chandni Chowk market', reasoning: 'Monthly competitor price tracking overdue for Delhi territory. Key competitor launched price cuts on beverages last week. Need updated data for 15 SKUs.', priority: TaskPriority.MEDIUM, score: 65 },
];

const taskStatuses: TaskStatus[] = [
  TaskStatus.PENDING, TaskStatus.PENDING, TaskStatus.PENDING,
  TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.COMPLETED,
];

export const mockTasks: Task[] = Array.from({ length: 30 }, (_, i) => {
  const tmpl = taskTemplates[i % taskTemplates.length];
  const status = taskStatuses[i % taskStatuses.length];

  return {
    id: uid('tsk', i + 1),
    company_id: COMPANY_ID,
    rep_id: mockReps[i % 10].id,
    store_id: mockStores[i % 20].id,
    type: tmpl.type,
    status,
    priority: tmpl.priority,
    source: TaskSource.AI_GENERATED,
    title: tmpl.title,
    description: null,
    ai_reasoning: tmpl.reasoning,
    action_data: null,
    priority_score: tmpl.score - (i % 5),
    estimated_impact: Math.round(1000 + (i * 317) % 9000),
    points_reward: tmpl.priority === TaskPriority.CRITICAL ? 25 : tmpl.priority === TaskPriority.HIGH ? 15 : 10,
    scheduled_date: daysAgo(i < 15 ? 0 : i - 15),
    due_date: daysAgo(i < 15 ? -1 : i - 16),
    started_at: status !== TaskStatus.PENDING ? hoursAgo(i + 2) : null,
    completed_at: status === TaskStatus.COMPLETED ? hoursAgo(i) : null,
    completion_notes: status === TaskStatus.COMPLETED ? 'Task completed successfully' : null,
    visit_id: null,
    created_at: daysAgo(1),
    updated_at: hoursAgo(i),
    deleted_at: null,
  };
});

// ---------------------------------------------------------------------------
// mockOrders -- 15 orders from various sources
// ---------------------------------------------------------------------------

const orderSources: OrderSource[] = [
  OrderSource.WHATSAPP_TEXT, OrderSource.MANUAL, OrderSource.PWA,
  OrderSource.WHATSAPP_VOICE, OrderSource.WHATSAPP_IMAGE,
  OrderSource.MOBILE_APP, OrderSource.PERFECT_BASKET,
];
const orderStatuses: OrderStatus[] = [
  OrderStatus.CONFIRMED, OrderStatus.DELIVERED, OrderStatus.PROCESSING,
  OrderStatus.PENDING, OrderStatus.DISPATCHED,
];
const paymentStatuses: PaymentStatus[] = [
  PaymentStatus.PAID, PaymentStatus.UNPAID,
  PaymentStatus.CREDIT, PaymentStatus.PARTIALLY_PAID,
];

export const mockOrders: Order[] = Array.from({ length: 15 }, (_, i) => {
  const source = orderSources[i % orderSources.length];
  const itemCount = 2 + (i % 4);

  const items = Array.from({ length: itemCount }, (_, j) => {
    const prod = mockProducts[(i + j) % 20];
    const qty = 1 + (j % 5);
    const unitPrice = prod.selling_price;
    const totalPrice = unitPrice * qty;
    const discountPct = j === 0 ? 5 : 0;
    const discountAmt = Math.round(totalPrice * discountPct / 100);
    const taxPct = 18;
    const taxAmt = Math.round((totalPrice - discountAmt) * taxPct / 100);
    const netAmt = totalPrice - discountAmt + taxAmt;

    return {
      id: uid('oit', i * 10 + j + 1),
      order_id: uid('ord', i + 1),
      product_id: prod.id,
      product_name: prod.name,
      sku_code: prod.sku_code,
      quantity: qty,
      unit_price: unitPrice,
      total_price: totalPrice,
      discount_percent: discountPct,
      discount_amount: discountAmt,
      tax_percent: taxPct,
      tax_amount: taxAmt,
      net_amount: netAmt,
      created_at: daysAgo(i),
    };
  });

  const subtotal = items.reduce((s, it) => s + it.total_price, 0);
  const discountTotal = items.reduce((s, it) => s + it.discount_amount, 0);
  const taxTotal = items.reduce((s, it) => s + it.tax_amount, 0);
  const grandTotal = subtotal - discountTotal + taxTotal;

  return {
    id: uid('ord', i + 1),
    company_id: COMPANY_ID,
    store_id: mockStores[i % 20].id,
    rep_id: mockReps[i % 10].id,
    order_number: `ORD-2026-${String(1000 + i).padStart(5, '0')}`,
    source,
    status: orderStatuses[i % orderStatuses.length],
    payment_status: paymentStatuses[i % paymentStatuses.length],
    whatsapp_msg_id: source.startsWith('WHATSAPP') ? `wamid.${i}abc123` : null,
    subtotal,
    discount_total: discountTotal,
    tax_total: taxTotal,
    grand_total: grandTotal,
    notes: null,
    delivery_date: daysAgo(i > 3 ? i - 3 : -2),
    delivered_at: orderStatuses[i % orderStatuses.length] === OrderStatus.DELIVERED ? daysAgo(i - 1) : null,
    cancelled_at: null,
    cancellation_reason: null,
    items,
    created_at: daysAgo(i),
    updated_at: daysAgo(Math.max(i - 1, 0)),
    deleted_at: null,
  };
});

// ---------------------------------------------------------------------------
// mockKPIs
// ---------------------------------------------------------------------------

export const mockKPIs = {
  revenue_today: 284500,
  revenue_month: 4_825_000,
  stores_total: 20,
  stores_visited: 14,
  task_completion_rate: 72.5,
  active_reps: 9,
  total_reps: 10,
  orders_today: 18,
  ai_tasks_generated: 248,
};

// ---------------------------------------------------------------------------
// mockAnalytics
// ---------------------------------------------------------------------------

export const mockAnalytics = {
  revenue_trend: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
    revenue: Math.round(120_000 + ((i * 7919) % 80_000) + i * 2000),
  })),

  top_products: [
    { name: 'Coca-Cola 300ml', revenue: 425000, units_sold: 2480 },
    { name: 'Maggi 2-Minute Noodles 70g', revenue: 380000, units_sold: 3800 },
    { name: 'Lays Classic Salted 52g', revenue: 312000, units_sold: 2600 },
    { name: 'Thums Up 250ml', revenue: 298000, units_sold: 2200 },
    { name: 'Parle-G Glucose Biscuit 82g', revenue: 275000, units_sold: 5500 },
    { name: 'Surf Excel Easy Wash 1kg', revenue: 248000, units_sold: 920 },
    { name: 'Amul Taaza Milk 500ml', revenue: 215000, units_sold: 4300 },
    { name: 'Clinic Plus Shampoo 175ml', revenue: 198000, units_sold: 1100 },
  ],

  territory_performance: [
    { territory: 'Mumbai', revenue: 1_850_000, orders: 312, stores: 6, reps: 3, coverage: 92 },
    { territory: 'Delhi', revenue: 1_420_000, orders: 245, stores: 4, reps: 2, coverage: 88 },
    { territory: 'Bangalore', revenue: 1_180_000, orders: 198, stores: 4, reps: 2, coverage: 85 },
    { territory: 'Chennai', revenue: 890_000, orders: 156, stores: 3, reps: 2, coverage: 78 },
    { territory: 'Kolkata', revenue: 685_000, orders: 124, stores: 3, reps: 2, coverage: 72 },
  ],

  channel_split: [
    { channel: 'General Trade', count: 156, percentage: 52, revenue: 2_509_000 },
    { channel: 'Supermarket', count: 66, percentage: 22, revenue: 1_061_500 },
    { channel: 'Modern Trade', count: 45, percentage: 15, revenue: 723_750 },
    { channel: 'HoReCa', count: 21, percentage: 7, revenue: 337_750 },
    { channel: 'Other', count: 12, percentage: 4, revenue: 193_000 },
  ],
};

export const mockTaskStatusDistribution = [
  { status: 'Completed', count: 18, color: '#22c55e' },
  { status: 'In Progress', count: 5, color: '#3b82f6' },
  { status: 'Pending', count: 4, color: '#f59e0b' },
  { status: 'Overdue', count: 3, color: '#ef4444' },
];
