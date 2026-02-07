// =============================================================================
// OpenSalesAI — Demo Data Seed Script
// =============================================================================
// Generates realistic Indian CPG demo data:
//   - 1 Tenant, 1 Company
//   - 50 Stores (Indian cities/areas with real coordinates)
//   - 200 Products (Indian FMCG brands: Parle, Britannia, HUL, ITC, Dabur, etc.)
//   - 10 Sales Reps
//   - 5000 Transactions over 90 days
//   - AI-generated Tasks, sample Visits, eB2B Orders, Predictions, Incentives
//
// Usage:
//   npx ts-node scripts/seed-demo.ts
//   # or
//   npx tsx scripts/seed-demo.ts
// =============================================================================

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min: number, max: number, decimals = 2): number {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(daysAgo: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return new Date(
    past.getTime() + Math.random() * (now.getTime() - past.getTime())
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Fixed IDs for the default tenant and company
// ---------------------------------------------------------------------------
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Indian Store Data (50 stores across major Indian cities)
// ---------------------------------------------------------------------------
interface StoreData {
  name: string;
  ownerName: string;
  ownerPhone: string;
  lat: number;
  lng: number;
  address: string;
  channelType: "KIRANA" | "SUPERMARKET" | "WHOLESALE" | "GENERAL_TRADE";
  territory: string;
}

const STORES: StoreData[] = [
  // Mumbai - Western Suburbs
  { name: "Sharma General Store", ownerName: "Rajesh Sharma", ownerPhone: "+919876543210", lat: 19.0760, lng: 72.8777, address: "Shop 12, Andheri West, Mumbai 400058", channelType: "KIRANA", territory: "Mumbai-West" },
  { name: "Patel Supermart", ownerName: "Nitin Patel", ownerPhone: "+919876543211", lat: 19.1136, lng: 72.8697, address: "Goregaon East, Mumbai 400063", channelType: "SUPERMARKET", territory: "Mumbai-West" },
  { name: "Gupta Wholesale", ownerName: "Suresh Gupta", ownerPhone: "+919876543212", lat: 19.0596, lng: 72.8295, address: "Juhu, Mumbai 400049", channelType: "WHOLESALE", territory: "Mumbai-West" },
  { name: "Deshmukh Kirana", ownerName: "Anil Deshmukh", ownerPhone: "+919876543213", lat: 19.1255, lng: 72.8362, address: "Malad West, Mumbai 400064", channelType: "KIRANA", territory: "Mumbai-West" },
  { name: "Verma Provisions", ownerName: "Ramesh Verma", ownerPhone: "+919876543214", lat: 19.0890, lng: 72.8338, address: "Versova, Mumbai 400061", channelType: "GENERAL_TRADE", territory: "Mumbai-West" },
  // Mumbai - Central
  { name: "Joshi Mart", ownerName: "Vijay Joshi", ownerPhone: "+919876543215", lat: 19.0176, lng: 72.8562, address: "Dadar West, Mumbai 400028", channelType: "SUPERMARKET", territory: "Mumbai-Central" },
  { name: "Iyer Stores", ownerName: "Subramaniam Iyer", ownerPhone: "+919876543216", lat: 18.9985, lng: 72.8347, address: "Lower Parel, Mumbai 400013", channelType: "KIRANA", territory: "Mumbai-Central" },
  { name: "Kamath Groceries", ownerName: "Suresh Kamath", ownerPhone: "+919876543217", lat: 19.0437, lng: 72.8554, address: "Bandra West, Mumbai 400050", channelType: "KIRANA", territory: "Mumbai-Central" },
  { name: "Nair General Trade", ownerName: "Gopakumar Nair", ownerPhone: "+919876543218", lat: 19.0280, lng: 72.8545, address: "Mahim, Mumbai 400016", channelType: "GENERAL_TRADE", territory: "Mumbai-Central" },
  { name: "Thakur Cash & Carry", ownerName: "Pramod Thakur", ownerPhone: "+919876543219", lat: 19.0510, lng: 72.8417, address: "Khar, Mumbai 400052", channelType: "WHOLESALE", territory: "Mumbai-Central" },
  // Delhi NCR
  { name: "Aggarwal Store", ownerName: "Manoj Aggarwal", ownerPhone: "+919876543220", lat: 28.6139, lng: 77.2090, address: "Connaught Place, New Delhi 110001", channelType: "KIRANA", territory: "Delhi-Central" },
  { name: "Bansal Mart", ownerName: "Vikram Bansal", ownerPhone: "+919876543221", lat: 28.5355, lng: 77.2100, address: "Saket, New Delhi 110017", channelType: "SUPERMARKET", territory: "Delhi-South" },
  { name: "Mittal Wholesale Hub", ownerName: "Aman Mittal", ownerPhone: "+919876543222", lat: 28.6891, lng: 77.2219, address: "Chandni Chowk, Old Delhi 110006", channelType: "WHOLESALE", territory: "Delhi-Central" },
  { name: "Tiwari Corner Shop", ownerName: "Rajan Tiwari", ownerPhone: "+919876543223", lat: 28.6280, lng: 77.2186, address: "Karol Bagh, New Delhi 110005", channelType: "KIRANA", territory: "Delhi-Central" },
  { name: "Goel Provisions", ownerName: "Sandeep Goel", ownerPhone: "+919876543224", lat: 28.5672, lng: 77.3210, address: "Noida Sector 18, UP 201301", channelType: "GENERAL_TRADE", territory: "Delhi-NCR" },
  { name: "Chawla Superstore", ownerName: "Harpreet Chawla", ownerPhone: "+919876543225", lat: 28.4595, lng: 77.0266, address: "Gurugram Sector 29, Haryana 122001", channelType: "SUPERMARKET", territory: "Delhi-NCR" },
  // Bangalore
  { name: "Reddy Kirana", ownerName: "Venkat Reddy", ownerPhone: "+919876543226", lat: 12.9716, lng: 77.5946, address: "MG Road, Bangalore 560001", channelType: "KIRANA", territory: "Bangalore-Central" },
  { name: "Krishna General Store", ownerName: "Krishna Murthy", ownerPhone: "+919876543227", lat: 12.9352, lng: 77.6245, address: "Koramangala, Bangalore 560034", channelType: "KIRANA", territory: "Bangalore-South" },
  { name: "Lakshmi Supermart", ownerName: "Lakshmi Devi", ownerPhone: "+919876543228", lat: 12.9698, lng: 77.7500, address: "Whitefield, Bangalore 560066", channelType: "SUPERMARKET", territory: "Bangalore-East" },
  { name: "Hegde Provisions", ownerName: "Arun Hegde", ownerPhone: "+919876543229", lat: 13.0358, lng: 77.5970, address: "Rajajinagar, Bangalore 560010", channelType: "GENERAL_TRADE", territory: "Bangalore-North" },
  { name: "Shetty Cash Point", ownerName: "Ramesh Shetty", ownerPhone: "+919876543230", lat: 12.9141, lng: 77.6446, address: "HSR Layout, Bangalore 560102", channelType: "WHOLESALE", territory: "Bangalore-South" },
  // Hyderabad
  { name: "Rao General Store", ownerName: "Suresh Rao", ownerPhone: "+919876543231", lat: 17.3850, lng: 78.4867, address: "Ameerpet, Hyderabad 500016", channelType: "KIRANA", territory: "Hyderabad" },
  { name: "Naidu Mart", ownerName: "Srinivas Naidu", ownerPhone: "+919876543232", lat: 17.4239, lng: 78.4489, address: "Kukatpally, Hyderabad 500072", channelType: "SUPERMARKET", territory: "Hyderabad" },
  { name: "Begum Wholesale", ownerName: "Ahmed Khan", ownerPhone: "+919876543233", lat: 17.3616, lng: 78.4747, address: "Charminar, Hyderabad 500002", channelType: "WHOLESALE", territory: "Hyderabad" },
  { name: "Prasad Kirana Bhandar", ownerName: "Ravi Prasad", ownerPhone: "+919876543234", lat: 17.4400, lng: 78.3489, address: "Gachibowli, Hyderabad 500032", channelType: "KIRANA", territory: "Hyderabad" },
  // Chennai
  { name: "Murugan Stores", ownerName: "Murugan Pillai", ownerPhone: "+919876543235", lat: 13.0827, lng: 80.2707, address: "T. Nagar, Chennai 600017", channelType: "KIRANA", territory: "Chennai" },
  { name: "Subramanian Mart", ownerName: "K Subramanian", ownerPhone: "+919876543236", lat: 13.0569, lng: 80.2425, address: "Adyar, Chennai 600020", channelType: "SUPERMARKET", territory: "Chennai" },
  { name: "Selvam Wholesale", ownerName: "Selvam Raja", ownerPhone: "+919876543237", lat: 13.0878, lng: 80.2785, address: "Mylapore, Chennai 600004", channelType: "WHOLESALE", territory: "Chennai" },
  { name: "Annamalai General", ownerName: "R Annamalai", ownerPhone: "+919876543238", lat: 13.0400, lng: 80.2338, address: "Velachery, Chennai 600042", channelType: "GENERAL_TRADE", territory: "Chennai" },
  // Kolkata
  { name: "Chatterjee & Sons", ownerName: "Partha Chatterjee", ownerPhone: "+919876543239", lat: 22.5726, lng: 88.3639, address: "Park Street, Kolkata 700016", channelType: "KIRANA", territory: "Kolkata" },
  { name: "Banerjee Mart", ownerName: "Soumya Banerjee", ownerPhone: "+919876543240", lat: 22.5488, lng: 88.3510, address: "Ballygunge, Kolkata 700019", channelType: "SUPERMARKET", territory: "Kolkata" },
  { name: "Das Wholesale Point", ownerName: "Amit Das", ownerPhone: "+919876543241", lat: 22.5958, lng: 88.3700, address: "Howrah, Kolkata 711101", channelType: "WHOLESALE", territory: "Kolkata" },
  // Pune
  { name: "Kulkarni Kirana", ownerName: "Sudhir Kulkarni", ownerPhone: "+919876543242", lat: 18.5204, lng: 73.8567, address: "Shivajinagar, Pune 411005", channelType: "KIRANA", territory: "Pune" },
  { name: "Pawar Superstore", ownerName: "Sachin Pawar", ownerPhone: "+919876543243", lat: 18.5074, lng: 73.8077, address: "Kothrud, Pune 411038", channelType: "SUPERMARKET", territory: "Pune" },
  { name: "Jadhav Provisions", ownerName: "Mahesh Jadhav", ownerPhone: "+919876543244", lat: 18.5594, lng: 73.7858, address: "Aundh, Pune 411007", channelType: "GENERAL_TRADE", territory: "Pune" },
  // Ahmedabad
  { name: "Mehta General Store", ownerName: "Jayesh Mehta", ownerPhone: "+919876543245", lat: 23.0225, lng: 72.5714, address: "CG Road, Ahmedabad 380009", channelType: "KIRANA", territory: "Ahmedabad" },
  { name: "Shah Mart", ownerName: "Pranav Shah", ownerPhone: "+919876543246", lat: 23.0469, lng: 72.5310, address: "Satellite, Ahmedabad 380015", channelType: "SUPERMARKET", territory: "Ahmedabad" },
  { name: "Prajapati Store", ownerName: "Dinesh Prajapati", ownerPhone: "+919876543247", lat: 23.0793, lng: 72.6329, address: "Naroda, Ahmedabad 382330", channelType: "WHOLESALE", territory: "Ahmedabad" },
  // Jaipur
  { name: "Saini Kirana", ownerName: "Om Prakash Saini", ownerPhone: "+919876543248", lat: 26.9124, lng: 75.7873, address: "MI Road, Jaipur 302001", channelType: "KIRANA", territory: "Jaipur" },
  { name: "Shekhawat Mart", ownerName: "Bhanu Shekhawat", ownerPhone: "+919876543249", lat: 26.8854, lng: 75.8058, address: "Vaishali Nagar, Jaipur 302021", channelType: "SUPERMARKET", territory: "Jaipur" },
  // Lucknow
  { name: "Pandey General Store", ownerName: "Ashish Pandey", ownerPhone: "+919876543250", lat: 26.8467, lng: 80.9462, address: "Hazratganj, Lucknow 226001", channelType: "KIRANA", territory: "Lucknow" },
  { name: "Srivastava Provisions", ownerName: "Alok Srivastava", ownerPhone: "+919876543251", lat: 26.8584, lng: 80.9124, address: "Gomti Nagar, Lucknow 226010", channelType: "GENERAL_TRADE", territory: "Lucknow" },
  // Indore
  { name: "Jain Cash & Carry", ownerName: "Rahul Jain", ownerPhone: "+919876543252", lat: 22.7196, lng: 75.8577, address: "Sapna Sangeeta Road, Indore 452001", channelType: "WHOLESALE", territory: "Indore" },
  { name: "Rathore Kirana", ownerName: "Deepak Rathore", ownerPhone: "+919876543253", lat: 22.7533, lng: 75.8937, address: "Vijay Nagar, Indore 452010", channelType: "KIRANA", territory: "Indore" },
  // Chandigarh
  { name: "Singh Supermart", ownerName: "Gurpreet Singh", ownerPhone: "+919876543254", lat: 30.7333, lng: 76.7794, address: "Sector 17, Chandigarh 160017", channelType: "SUPERMARKET", territory: "Chandigarh" },
  { name: "Dhillon General", ownerName: "Jaspal Dhillon", ownerPhone: "+919876543255", lat: 30.7046, lng: 76.7179, address: "Sector 35, Chandigarh 160022", channelType: "GENERAL_TRADE", territory: "Chandigarh" },
  // Coimbatore
  { name: "Gounder Stores", ownerName: "Palani Gounder", ownerPhone: "+919876543256", lat: 11.0168, lng: 76.9558, address: "RS Puram, Coimbatore 641002", channelType: "KIRANA", territory: "Coimbatore" },
  { name: "Velmurugan Mart", ownerName: "S Velmurugan", ownerPhone: "+919876543257", lat: 11.0045, lng: 76.9619, address: "Gandhipuram, Coimbatore 641012", channelType: "SUPERMARKET", territory: "Coimbatore" },
  // Nagpur
  { name: "Deshmukh Provisions", ownerName: "Ganesh Deshmukh", ownerPhone: "+919876543258", lat: 21.1458, lng: 79.0882, address: "Sitabuldi, Nagpur 440012", channelType: "KIRANA", territory: "Nagpur" },
  { name: "Wankhede General", ownerName: "Sunil Wankhede", ownerPhone: "+919876543259", lat: 21.1542, lng: 79.0548, address: "Dharampeth, Nagpur 440010", channelType: "GENERAL_TRADE", territory: "Nagpur" },
];

// ---------------------------------------------------------------------------
// Indian FMCG Product Catalog (200 products)
// ---------------------------------------------------------------------------
interface ProductData {
  skuCode: string;
  name: string;
  category: string;
  subCategory: string;
  mrp: number;
  distributorPrice: number;
  marginPct: number;
  packSize: string;
  shelfLifeDays: number;
  isFocus: boolean;
}

function generateProducts(): ProductData[] {
  const products: ProductData[] = [];
  let skuCounter = 1;

  const sku = () => `SKU-${String(skuCounter++).padStart(4, "0")}`;

  // Parle Products (Biscuits & Snacks)
  const parle = [
    { name: "Parle-G Glucose Biscuits", sub: "Glucose", mrp: 10, pack: "80g" },
    { name: "Parle-G Glucose Biscuits", sub: "Glucose", mrp: 20, pack: "200g" },
    { name: "Parle-G Glucose Biscuits", sub: "Glucose", mrp: 45, pack: "500g" },
    { name: "Parle Monaco Classic", sub: "Salted", mrp: 30, pack: "150g" },
    { name: "Parle Monaco Cheez-lings", sub: "Snacks", mrp: 20, pack: "60g" },
    { name: "Parle KrackJack", sub: "Sweet & Salty", mrp: 10, pack: "60g" },
    { name: "Parle Hide & Seek", sub: "Chocolate", mrp: 30, pack: "100g" },
    { name: "Parle Fab!", sub: "Cream", mrp: 10, pack: "56g" },
    { name: "Parle Magix Cream", sub: "Cream", mrp: 5, pack: "24g" },
    { name: "Parle 20-20 Cashew Cookies", sub: "Cookies", mrp: 30, pack: "150g" },
    { name: "Parle Milano Choco Delight", sub: "Premium", mrp: 40, pack: "75g" },
    { name: "Parle Rusk Premium", sub: "Rusk", mrp: 30, pack: "200g" },
  ];
  for (const p of parle) {
    products.push({ skuCode: sku(), name: p.name, category: "Biscuits", subCategory: p.sub, mrp: p.mrp, distributorPrice: +(p.mrp * 0.78).toFixed(2), marginPct: 22, packSize: p.pack, shelfLifeDays: 180, isFocus: p.mrp >= 30 });
  }

  // Britannia Products
  const britannia = [
    { name: "Britannia Good Day Cashew", sub: "Cookies", mrp: 30, pack: "150g" },
    { name: "Britannia Good Day Butter", sub: "Cookies", mrp: 20, pack: "75g" },
    { name: "Britannia Marie Gold", sub: "Marie", mrp: 25, pack: "200g" },
    { name: "Britannia Tiger Glucose", sub: "Glucose", mrp: 10, pack: "80g" },
    { name: "Britannia 50-50 Maska Chaska", sub: "Salted", mrp: 20, pack: "120g" },
    { name: "Britannia Milk Bikis", sub: "Milk", mrp: 15, pack: "100g" },
    { name: "Britannia NutriChoice Digestive", sub: "Health", mrp: 45, pack: "100g" },
    { name: "Britannia NutriChoice Oats", sub: "Health", mrp: 35, pack: "75g" },
    { name: "Britannia Treat Croissant", sub: "Bakery", mrp: 20, pack: "45g" },
    { name: "Britannia Cheese Slices", sub: "Dairy", mrp: 85, pack: "200g" },
    { name: "Britannia Winkin Cow Milkshake", sub: "Dairy", mrp: 30, pack: "200ml" },
    { name: "Britannia Bread White", sub: "Bread", mrp: 40, pack: "400g" },
  ];
  for (const p of britannia) {
    products.push({ skuCode: sku(), name: p.name, category: "Biscuits & Bakery", subCategory: p.sub, mrp: p.mrp, distributorPrice: +(p.mrp * 0.80).toFixed(2), marginPct: 20, packSize: p.pack, shelfLifeDays: p.sub === "Dairy" || p.sub === "Bread" ? 14 : 180, isFocus: p.mrp >= 35 });
  }

  // HUL (Hindustan Unilever) - Personal Care
  const hul = [
    { name: "Lux Soft Touch Soap", sub: "Soap", mrp: 42, pack: "100g" },
    { name: "Lifebuoy Total 10 Soap", sub: "Soap", mrp: 35, pack: "100g" },
    { name: "Dove Cream Beauty Bar", sub: "Soap", mrp: 62, pack: "100g" },
    { name: "Surf Excel Easy Wash", sub: "Detergent", mrp: 10, pack: "100g" },
    { name: "Surf Excel Quick Wash", sub: "Detergent", mrp: 52, pack: "500g" },
    { name: "Surf Excel Matic TL", sub: "Detergent", mrp: 210, pack: "1kg" },
    { name: "Rin Advanced Bar", sub: "Detergent", mrp: 10, pack: "150g" },
    { name: "Vim Dishwash Bar", sub: "Dishwash", mrp: 10, pack: "130g" },
    { name: "Vim Dishwash Liquid", sub: "Dishwash", mrp: 99, pack: "500ml" },
    { name: "Clinic Plus Shampoo", sub: "Shampoo", mrp: 3, pack: "7ml" },
    { name: "Clinic Plus Shampoo", sub: "Shampoo", mrp: 95, pack: "175ml" },
    { name: "Sunsilk Thick & Long", sub: "Shampoo", mrp: 105, pack: "180ml" },
    { name: "Pond's Talcum Powder", sub: "Skincare", mrp: 75, pack: "100g" },
    { name: "Fair & Lovely Face Cream", sub: "Skincare", mrp: 59, pack: "50g" },
    { name: "Vaseline Body Lotion", sub: "Skincare", mrp: 175, pack: "200ml" },
    { name: "Close Up Toothpaste", sub: "Oral Care", mrp: 52, pack: "80g" },
    { name: "Pepsodent Germi Check", sub: "Oral Care", mrp: 46, pack: "100g" },
    { name: "Brooke Bond Red Label Tea", sub: "Tea", mrp: 42, pack: "100g" },
    { name: "Brooke Bond Red Label Tea", sub: "Tea", mrp: 190, pack: "500g" },
    { name: "Brooke Bond Taj Mahal Tea", sub: "Tea", mrp: 85, pack: "100g" },
    { name: "Lipton Green Tea", sub: "Tea", mrp: 150, pack: "100g" },
    { name: "Bru Instant Coffee", sub: "Coffee", mrp: 85, pack: "50g" },
    { name: "Bru Gold Instant Coffee", sub: "Coffee", mrp: 180, pack: "50g" },
    { name: "Kissan Tomato Ketchup", sub: "Sauces", mrp: 99, pack: "500g" },
    { name: "Kissan Mixed Fruit Jam", sub: "Jams", mrp: 110, pack: "500g" },
    { name: "Knorr Soupy Noodles", sub: "Instant Food", mrp: 15, pack: "44g" },
  ];
  for (const p of hul) {
    const cat = ["Tea", "Coffee", "Sauces", "Jams", "Instant Food"].includes(p.sub) ? "Food & Beverages" : "Personal Care";
    products.push({ skuCode: sku(), name: p.name, category: cat, subCategory: p.sub, mrp: p.mrp, distributorPrice: +(p.mrp * 0.82).toFixed(2), marginPct: 18, packSize: p.pack, shelfLifeDays: cat === "Personal Care" ? 730 : 365, isFocus: p.mrp >= 80 });
  }

  // ITC Products
  const itc = [
    { name: "Aashirvaad Atta", sub: "Flour", mrp: 295, pack: "5kg", cat: "Staples" },
    { name: "Aashirvaad Atta", sub: "Flour", mrp: 65, pack: "1kg", cat: "Staples" },
    { name: "Aashirvaad Multigrain Atta", sub: "Flour", mrp: 78, pack: "1kg", cat: "Staples" },
    { name: "Sunfeast Dark Fantasy", sub: "Premium", mrp: 40, pack: "75g", cat: "Biscuits" },
    { name: "Sunfeast Dark Fantasy Choco Fills", sub: "Premium", mrp: 30, pack: "60g", cat: "Biscuits" },
    { name: "Sunfeast Mom's Magic", sub: "Cookies", mrp: 20, pack: "60g", cat: "Biscuits" },
    { name: "Sunfeast Yippee Noodles", sub: "Noodles", mrp: 14, pack: "60g", cat: "Instant Food" },
    { name: "Sunfeast Yippee Noodles", sub: "Noodles", mrp: 65, pack: "280g", cat: "Instant Food" },
    { name: "Bingo! Mad Angles", sub: "Snacks", mrp: 20, pack: "72g", cat: "Snacks" },
    { name: "Bingo! Tedhe Medhe", sub: "Snacks", mrp: 10, pack: "44g", cat: "Snacks" },
    { name: "Bingo! Original Style", sub: "Chips", mrp: 20, pack: "52g", cat: "Snacks" },
    { name: "Bingo! Hashtags", sub: "Snacks", mrp: 20, pack: "60g", cat: "Snacks" },
    { name: "Candyman Fantastik", sub: "Candy", mrp: 5, pack: "18g", cat: "Confectionery" },
    { name: "Fabelle Choco Mousse", sub: "Premium Choc", mrp: 150, pack: "58g", cat: "Confectionery" },
    { name: "Savlon Antiseptic Liquid", sub: "Antiseptic", mrp: 78, pack: "100ml", cat: "Personal Care" },
    { name: "Fiama Gel Bathing Bar", sub: "Soap", mrp: 55, pack: "125g", cat: "Personal Care" },
    { name: "Engage Deo Spray", sub: "Deodorant", mrp: 185, pack: "150ml", cat: "Personal Care" },
    { name: "Classmate Notebook", sub: "Stationery", mrp: 45, pack: "180 pages", cat: "Stationery" },
  ];
  for (const p of itc) {
    products.push({ skuCode: sku(), name: p.name, category: p.cat, subCategory: p.sub, mrp: p.mrp, distributorPrice: +(p.mrp * 0.79).toFixed(2), marginPct: 21, packSize: p.pack, shelfLifeDays: p.cat === "Staples" ? 180 : 365, isFocus: p.mrp >= 50 });
  }

  // Dabur Products
  const dabur = [
    { name: "Dabur Real Fruit Juice Mango", sub: "Juice", mrp: 99, pack: "1L" },
    { name: "Dabur Real Fruit Juice Mixed", sub: "Juice", mrp: 99, pack: "1L" },
    { name: "Real Activ Orange Juice", sub: "Juice", mrp: 55, pack: "200ml" },
    { name: "Dabur Honey", sub: "Honey", mrp: 199, pack: "250g" },
    { name: "Dabur Honey", sub: "Honey", mrp: 99, pack: "100g" },
    { name: "Dabur Chyawanprash", sub: "Ayurveda", mrp: 295, pack: "500g" },
    { name: "Dabur Red Paste", sub: "Oral Care", mrp: 58, pack: "100g" },
    { name: "Dabur Amla Hair Oil", sub: "Hair Oil", mrp: 60, pack: "100ml" },
    { name: "Dabur Amla Hair Oil", sub: "Hair Oil", mrp: 135, pack: "275ml" },
    { name: "Dabur Vatika Shampoo", sub: "Shampoo", mrp: 89, pack: "180ml" },
    { name: "Dabur Gulabari Rose Water", sub: "Skincare", mrp: 60, pack: "120ml" },
    { name: "Hajmola Tablet", sub: "Digestive", mrp: 5, pack: "4 tabs" },
    { name: "Hajmola Tablet Bottle", sub: "Digestive", mrp: 50, pack: "120 tabs" },
    { name: "Pudin Hara Pearls", sub: "Digestive", mrp: 20, pack: "10 caps" },
  ];
  for (const p of dabur) {
    const cat = ["Juice"].includes(p.sub) ? "Beverages" : ["Honey", "Ayurveda", "Digestive"].includes(p.sub) ? "Health & Wellness" : "Personal Care";
    products.push({ skuCode: sku(), name: p.name, category: cat, subCategory: p.sub, mrp: p.mrp, distributorPrice: +(p.mrp * 0.80).toFixed(2), marginPct: 20, packSize: p.pack, shelfLifeDays: p.sub === "Juice" ? 180 : 730, isFocus: p.mrp >= 90 });
  }

  // Nestle India
  const nestle = [
    { name: "Maggi 2-Minute Noodles", sub: "Noodles", mrp: 14, pack: "70g" },
    { name: "Maggi 2-Minute Noodles", sub: "Noodles", mrp: 60, pack: "280g" },
    { name: "Maggi Masala-ae-Magic", sub: "Seasoning", mrp: 5, pack: "6g" },
    { name: "Nescafe Classic Coffee", sub: "Coffee", mrp: 95, pack: "50g" },
    { name: "Nescafe Classic Coffee", sub: "Coffee", mrp: 265, pack: "200g" },
    { name: "Nescafe Gold Blend", sub: "Coffee", mrp: 365, pack: "100g" },
    { name: "Nestle Everyday Dairy", sub: "Dairy", mrp: 22, pack: "20g" },
    { name: "Nestle a+ Curd", sub: "Dairy", mrp: 25, pack: "200g" },
    { name: "Nestle KitKat", sub: "Chocolate", mrp: 50, pack: "37.3g" },
    { name: "Nestle Munch", sub: "Chocolate", mrp: 5, pack: "10.1g" },
    { name: "Nestle Munch", sub: "Chocolate", mrp: 20, pack: "46g" },
    { name: "Nestle Bar One", sub: "Chocolate", mrp: 20, pack: "32.5g" },
    { name: "Nestle Milkmaid", sub: "Dairy", mrp: 110, pack: "400g" },
    { name: "Maggi Hot & Sweet Sauce", sub: "Sauces", mrp: 99, pack: "500g" },
  ];
  for (const p of nestle) {
    const cat = ["Coffee", "Noodles", "Seasoning", "Sauces"].includes(p.sub) ? "Food & Beverages" : p.sub === "Chocolate" ? "Confectionery" : "Dairy";
    products.push({ skuCode: sku(), name: p.name, category: cat, subCategory: p.sub, mrp: p.mrp, distributorPrice: +(p.mrp * 0.81).toFixed(2), marginPct: 19, packSize: p.pack, shelfLifeDays: p.sub === "Dairy" ? 21 : 365, isFocus: p.mrp >= 50 });
  }

  // Marico Products
  const marico = [
    { name: "Parachute Coconut Oil", sub: "Hair Oil", mrp: 55, pack: "100ml" },
    { name: "Parachute Coconut Oil", sub: "Hair Oil", mrp: 210, pack: "500ml" },
    { name: "Parachute Advansed Aloe Vera", sub: "Hair Oil", mrp: 65, pack: "150ml" },
    { name: "Saffola Gold Oil", sub: "Edible Oil", mrp: 180, pack: "1L" },
    { name: "Saffola Total Oil", sub: "Edible Oil", mrp: 165, pack: "1L" },
    { name: "Saffola Oats", sub: "Health Food", mrp: 30, pack: "40g" },
    { name: "Saffola Oats Masala", sub: "Health Food", mrp: 30, pack: "39g" },
    { name: "Set Wet Hair Gel", sub: "Grooming", mrp: 99, pack: "100ml" },
    { name: "Livon Hair Serum", sub: "Hair Care", mrp: 95, pack: "20ml" },
    { name: "Nihar Naturals Coconut Oil", sub: "Hair Oil", mrp: 40, pack: "100ml" },
  ];
  for (const p of marico) {
    const cat = ["Edible Oil", "Health Food"].includes(p.sub) ? "Food & Staples" : "Personal Care";
    products.push({ skuCode: sku(), name: p.name, category: cat, subCategory: p.sub, mrp: p.mrp, distributorPrice: +(p.mrp * 0.80).toFixed(2), marginPct: 20, packSize: p.pack, shelfLifeDays: 730, isFocus: p.mrp >= 90 });
  }

  // Godrej Consumer
  const godrej = [
    { name: "Godrej No.1 Bathing Soap", sub: "Soap", mrp: 30, pack: "100g" },
    { name: "Cinthol Deo Soap", sub: "Soap", mrp: 42, pack: "100g" },
    { name: "Godrej Expert Hair Colour", sub: "Hair Color", mrp: 30, pack: "20ml" },
    { name: "Godrej aer Matic Refill", sub: "Air Care", mrp: 299, pack: "225ml" },
    { name: "Godrej aer Spray", sub: "Air Care", mrp: 169, pack: "240ml" },
    { name: "Godrej Protekt Handwash", sub: "Hygiene", mrp: 85, pack: "250ml" },
    { name: "HIT Mosquito Spray", sub: "Pest Control", mrp: 119, pack: "200ml" },
    { name: "Good Knight Advanced", sub: "Pest Control", mrp: 48, pack: "45ml refill" },
  ];
  for (const p of godrej) {
    products.push({ skuCode: sku(), name: p.name, category: "Home & Personal Care", subCategory: p.sub, mrp: p.mrp, distributorPrice: +(p.mrp * 0.79).toFixed(2), marginPct: 21, packSize: p.pack, shelfLifeDays: 730, isFocus: p.mrp >= 85 });
  }

  // Amul Products
  const amul = [
    { name: "Amul Taaza Toned Milk", sub: "Milk", mrp: 25, pack: "500ml" },
    { name: "Amul Gold Full Cream Milk", sub: "Milk", mrp: 33, pack: "500ml" },
    { name: "Amul Butter", sub: "Butter", mrp: 56, pack: "100g" },
    { name: "Amul Cheese Slices", sub: "Cheese", mrp: 90, pack: "200g" },
    { name: "Amul Paneer Fresh", sub: "Paneer", mrp: 80, pack: "200g" },
    { name: "Amul Dark Chocolate", sub: "Chocolate", mrp: 100, pack: "150g" },
    { name: "Amul Kool Cafe", sub: "Cold Coffee", mrp: 25, pack: "200ml" },
    { name: "Amul Lassi Mango", sub: "Lassi", mrp: 25, pack: "200ml" },
    { name: "Amul Ice Cream Vanilla", sub: "Ice Cream", mrp: 120, pack: "500ml" },
    { name: "Amul Ghee", sub: "Ghee", mrp: 290, pack: "500ml" },
  ];
  for (const p of amul) {
    products.push({ skuCode: sku(), name: p.name, category: "Dairy", subCategory: p.sub, mrp: p.mrp, distributorPrice: +(p.mrp * 0.88).toFixed(2), marginPct: 12, packSize: p.pack, shelfLifeDays: ["Milk", "Paneer", "Lassi"].includes(p.sub) ? 7 : p.sub === "Ghee" ? 365 : 90, isFocus: p.mrp >= 80 });
  }

  // Colgate-Palmolive
  const colgate = [
    { name: "Colgate Strong Teeth", sub: "Toothpaste", mrp: 52, pack: "100g" },
    { name: "Colgate MaxFresh", sub: "Toothpaste", mrp: 67, pack: "80g" },
    { name: "Colgate Total", sub: "Toothpaste", mrp: 95, pack: "120g" },
    { name: "Colgate Toothbrush Zigzag", sub: "Toothbrush", mrp: 20, pack: "1pc" },
    { name: "Colgate Mouthwash Plax", sub: "Mouthwash", mrp: 120, pack: "250ml" },
    { name: "Palmolive Soap", sub: "Soap", mrp: 40, pack: "100g" },
  ];
  for (const p of colgate) {
    products.push({ skuCode: sku(), name: p.name, category: "Oral & Personal Care", subCategory: p.sub, mrp: p.mrp, distributorPrice: +(p.mrp * 0.80).toFixed(2), marginPct: 20, packSize: p.pack, shelfLifeDays: 730, isFocus: p.mrp >= 60 });
  }

  // Pepsi/Coca-Cola Beverages
  const beverages = [
    { name: "Coca-Cola", sub: "Cola", mrp: 40, pack: "750ml" },
    { name: "Coca-Cola", sub: "Cola", mrp: 20, pack: "300ml" },
    { name: "Thums Up", sub: "Cola", mrp: 40, pack: "750ml" },
    { name: "Sprite", sub: "Lemon", mrp: 40, pack: "750ml" },
    { name: "Fanta Orange", sub: "Orange", mrp: 40, pack: "750ml" },
    { name: "Limca", sub: "Lemon", mrp: 20, pack: "300ml" },
    { name: "Maaza Mango Drink", sub: "Mango", mrp: 25, pack: "250ml" },
    { name: "Pepsi", sub: "Cola", mrp: 40, pack: "750ml" },
    { name: "Mountain Dew", sub: "Citrus", mrp: 40, pack: "750ml" },
    { name: "7UP", sub: "Lemon", mrp: 40, pack: "750ml" },
    { name: "Mirinda Orange", sub: "Orange", mrp: 20, pack: "300ml" },
    { name: "Slice Mango", sub: "Mango", mrp: 30, pack: "250ml" },
    { name: "Paper Boat Aam Panna", sub: "Traditional", mrp: 30, pack: "200ml" },
    { name: "Bisleri Water", sub: "Water", mrp: 20, pack: "1L" },
  ];
  for (const p of beverages) {
    products.push({ skuCode: sku(), name: p.name, category: "Beverages", subCategory: p.sub, mrp: p.mrp, distributorPrice: +(p.mrp * 0.75).toFixed(2), marginPct: 25, packSize: p.pack, shelfLifeDays: p.sub === "Water" ? 365 : 180, isFocus: p.mrp >= 30 });
  }

  return products.slice(0, 200);
}

// ---------------------------------------------------------------------------
// Sales Rep Data (10 reps)
// ---------------------------------------------------------------------------
interface RepData {
  name: string;
  phone: string;
  email: string;
  territory: string;
  dailyTarget: number;
  monthlyQuota: number;
  skillTier: "A" | "B" | "C";
}

const REPS: RepData[] = [
  { name: "Amit Kumar", phone: "+919800001001", email: "amit.kumar@opensalesai.com", territory: "Mumbai-West", dailyTarget: 12, monthlyQuota: 500000, skillTier: "A" },
  { name: "Priya Singh", phone: "+919800001002", email: "priya.singh@opensalesai.com", territory: "Mumbai-Central", dailyTarget: 10, monthlyQuota: 400000, skillTier: "A" },
  { name: "Rahul Verma", phone: "+919800001003", email: "rahul.verma@opensalesai.com", territory: "Delhi-Central", dailyTarget: 12, monthlyQuota: 550000, skillTier: "B" },
  { name: "Sneha Patel", phone: "+919800001004", email: "sneha.patel@opensalesai.com", territory: "Delhi-NCR", dailyTarget: 10, monthlyQuota: 450000, skillTier: "B" },
  { name: "Vikram Reddy", phone: "+919800001005", email: "vikram.reddy@opensalesai.com", territory: "Bangalore-Central", dailyTarget: 11, monthlyQuota: 480000, skillTier: "A" },
  { name: "Deepa Nair", phone: "+919800001006", email: "deepa.nair@opensalesai.com", territory: "Chennai", dailyTarget: 10, monthlyQuota: 400000, skillTier: "B" },
  { name: "Arjun Sharma", phone: "+919800001007", email: "arjun.sharma@opensalesai.com", territory: "Hyderabad", dailyTarget: 10, monthlyQuota: 420000, skillTier: "C" },
  { name: "Kavita Joshi", phone: "+919800001008", email: "kavita.joshi@opensalesai.com", territory: "Pune", dailyTarget: 8, monthlyQuota: 350000, skillTier: "B" },
  { name: "Sanjay Gupta", phone: "+919800001009", email: "sanjay.gupta@opensalesai.com", territory: "Kolkata", dailyTarget: 9, monthlyQuota: 380000, skillTier: "C" },
  { name: "Meera Iyer", phone: "+919800001010", email: "meera.iyer@opensalesai.com", territory: "Ahmedabad", dailyTarget: 10, monthlyQuota: 400000, skillTier: "B" },
];

// Territory to rep mapping (so stores get assigned to the right rep)
function getTerritoriesForRep(territory: string): string[] {
  const mapping: Record<string, string[]> = {
    "Mumbai-West": ["Mumbai-West"],
    "Mumbai-Central": ["Mumbai-Central"],
    "Delhi-Central": ["Delhi-Central"],
    "Delhi-NCR": ["Delhi-NCR", "Delhi-South"],
    "Bangalore-Central": ["Bangalore-Central", "Bangalore-South", "Bangalore-East", "Bangalore-North"],
    "Chennai": ["Chennai"],
    "Hyderabad": ["Hyderabad"],
    "Pune": ["Pune"],
    "Kolkata": ["Kolkata"],
    "Ahmedabad": ["Ahmedabad", "Jaipur", "Lucknow", "Indore", "Chandigarh", "Coimbatore", "Nagpur"],
  };
  return mapping[territory] || [territory];
}

// ---------------------------------------------------------------------------
// Main Seed Function
// ---------------------------------------------------------------------------
async function seed(): Promise<void> {
  console.log("=============================================================");
  console.log("  OpenSalesAI — Seeding Demo Data");
  console.log("=============================================================\n");

  // -------------------------------------------------------------------------
  // 1. Clean existing data (in dependency order)
  // -------------------------------------------------------------------------
  console.log("[1/9] Cleaning existing data...");
  await prisma.incentive.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.orderEb2b.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.task.deleteMany();
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.rep.deleteMany();
  await prisma.company.deleteMany();
  await prisma.tenant.deleteMany();
  console.log("  Done.\n");

  // -------------------------------------------------------------------------
  // 2. Create Tenant
  // -------------------------------------------------------------------------
  console.log("[2/9] Creating tenant...");
  const tenant = await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: "OpenSalesAI Demo",
      slug: "demo",
      plan: "GROWTH",
      settings: {
        currency: "INR",
        timezone: "Asia/Kolkata",
        language: "en",
        country: "IN",
        gpsRadiusMeters: 100,
        minVisitMinutes: 5,
      },
    },
  });
  console.log(`  Tenant: ${tenant.name} (${tenant.id})\n`);

  // -------------------------------------------------------------------------
  // 3. Create Company
  // -------------------------------------------------------------------------
  console.log("[3/9] Creating company...");
  const company = await prisma.company.create({
    data: {
      id: COMPANY_ID,
      tenantId: TENANT_ID,
      name: "Bharat Consumer Products Pvt. Ltd.",
      gstNumber: "27AABCU9603R1ZM",
      address: "Plot 45, MIDC Industrial Area, Andheri East, Mumbai 400093, Maharashtra, India",
    },
  });
  console.log(`  Company: ${company.name}\n`);

  // -------------------------------------------------------------------------
  // 4. Create Reps
  // -------------------------------------------------------------------------
  console.log("[4/9] Creating 10 sales reps...");
  const repRecords: Array<{ id: string; territory: string }> = [];
  for (const rep of REPS) {
    const created = await prisma.rep.create({
      data: {
        companyId: COMPANY_ID,
        name: rep.name,
        phone: rep.phone,
        email: rep.email,
        territory: rep.territory,
        dailyTarget: rep.dailyTarget,
        monthlyQuota: new Prisma.Decimal(rep.monthlyQuota),
        pointsBalance: randomInt(50, 500),
        skillTier: rep.skillTier,
        isActive: true,
      },
    });
    repRecords.push({ id: created.id, territory: created.territory });
    console.log(`  Rep: ${rep.name} (${rep.territory})`);
  }
  console.log();

  // -------------------------------------------------------------------------
  // 5. Create Stores (50 stores assigned to reps by territory)
  // -------------------------------------------------------------------------
  console.log("[5/9] Creating 50 stores...");
  const storeRecords: Array<{ id: string; companyId: string }> = [];

  const mslTiers: Array<"GOLD" | "SILVER" | "BRONZE"> = ["GOLD", "SILVER", "BRONZE"];
  const creditScores: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];

  for (const store of STORES) {
    // Find matching rep for territory
    const matchingRep = repRecords.find((r) => {
      const territories = getTerritoriesForRep(r.territory);
      return territories.includes(store.territory);
    });

    const created = await prisma.store.create({
      data: {
        companyId: COMPANY_ID,
        name: store.name,
        channelType: store.channelType,
        ownerName: store.ownerName,
        ownerPhone: store.ownerPhone,
        lat: new Prisma.Decimal(store.lat),
        lng: new Prisma.Decimal(store.lng),
        address: store.address,
        mslTier: randomElement(mslTiers),
        creditScore: randomElement(creditScores),
        assignedRepId: matchingRep?.id || null,
        lastVisitDate: randomDate(14),
      },
    });
    storeRecords.push({ id: created.id, companyId: COMPANY_ID });
  }
  console.log(`  Created ${storeRecords.length} stores.\n`);

  // -------------------------------------------------------------------------
  // 6. Create Products (200 products)
  // -------------------------------------------------------------------------
  console.log("[6/9] Creating 200 products...");
  const productData = generateProducts();
  const productRecords: Array<{ id: string; mrp: number; distributorPrice: number }> = [];

  for (const prod of productData) {
    const created = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        skuCode: prod.skuCode,
        name: prod.name,
        category: prod.category,
        subCategory: prod.subCategory,
        mrp: new Prisma.Decimal(prod.mrp),
        distributorPrice: new Prisma.Decimal(prod.distributorPrice),
        marginPct: new Prisma.Decimal(prod.marginPct),
        packSize: prod.packSize,
        shelfLifeDays: prod.shelfLifeDays,
        isFocus: prod.isFocus,
        launchDate: prod.isFocus ? randomDate(180) : null,
      },
    });
    productRecords.push({
      id: created.id,
      mrp: prod.mrp,
      distributorPrice: prod.distributorPrice,
    });
  }
  console.log(`  Created ${productRecords.length} products.\n`);

  // -------------------------------------------------------------------------
  // 7. Create Transactions (5000 over 90 days)
  // -------------------------------------------------------------------------
  console.log("[7/9] Creating 5000 transactions with line items...");
  const orderSources: Array<"MANUAL" | "EB2B" | "WHATSAPP" | "VOICE"> = [
    "MANUAL", "MANUAL", "MANUAL", "EB2B", "EB2B", "WHATSAPP", "WHATSAPP", "WHATSAPP", "VOICE",
  ];
  const distributorIds = ["DIST-MUM-001", "DIST-DEL-001", "DIST-BLR-001", "DIST-CHN-001", "DIST-HYD-001", "DIST-PUN-001", "DIST-KOL-001", "DIST-AHM-001"];

  let txnCount = 0;
  const BATCH_SIZE = 100;

  for (let batch = 0; batch < 50; batch++) {
    const txnBatch: Array<{
      storeId: string;
      repId: string;
      companyId: string;
      totalValue: Prisma.Decimal;
      orderSource: "MANUAL" | "EB2B" | "WHATSAPP" | "VOICE";
      distributorId: string;
      transactionDate: Date;
    }> = [];

    for (let i = 0; i < BATCH_SIZE; i++) {
      const store = randomElement(storeRecords);
      const rep = randomElement(repRecords);
      const itemCount = randomInt(2, 8);

      let totalValue = 0;
      for (let j = 0; j < itemCount; j++) {
        const product = randomElement(productRecords);
        const qty = randomInt(1, 24);
        totalValue += product.distributorPrice * qty;
      }

      txnBatch.push({
        storeId: store.id,
        repId: rep.id,
        companyId: COMPANY_ID,
        totalValue: new Prisma.Decimal(+totalValue.toFixed(2)),
        orderSource: randomElement(orderSources),
        distributorId: randomElement(distributorIds),
        transactionDate: randomDate(90),
      });
    }

    // Create transactions in batch
    for (const txn of txnBatch) {
      const itemCount = randomInt(2, 8);
      const items: Array<{
        productId: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }> = [];

      let recalcTotal = 0;
      for (let j = 0; j < itemCount; j++) {
        const product = randomElement(productRecords);
        const qty = randomInt(1, 24);
        const lineTotal = product.distributorPrice * qty;
        recalcTotal += lineTotal;

        items.push({
          productId: product.id,
          quantity: qty,
          unitPrice: new Prisma.Decimal(product.distributorPrice),
          lineTotal: new Prisma.Decimal(+lineTotal.toFixed(2)),
        });
      }

      await prisma.transaction.create({
        data: {
          storeId: txn.storeId,
          repId: txn.repId,
          companyId: txn.companyId,
          totalValue: new Prisma.Decimal(+recalcTotal.toFixed(2)),
          orderSource: txn.orderSource,
          distributorId: txn.distributorId,
          transactionDate: txn.transactionDate,
          items: {
            createMany: {
              data: items,
            },
          },
        },
      });

      txnCount++;
    }

    if ((batch + 1) % 10 === 0) {
      console.log(`  Progress: ${txnCount}/5000 transactions`);
    }
  }
  console.log(`  Created ${txnCount} transactions with line items.\n`);

  // -------------------------------------------------------------------------
  // 8. Create AI Tasks, Visits, eB2B Orders, Predictions
  // -------------------------------------------------------------------------
  console.log("[8/9] Creating tasks, visits, orders, and predictions...");

  const taskTypes: Array<"PUSH" | "MSL_FILL" | "REACTIVATION" | "UPSELL" | "CROSS_SELL" | "NEW_LAUNCH"> = [
    "PUSH", "MSL_FILL", "REACTIVATION", "UPSELL", "CROSS_SELL", "NEW_LAUNCH",
  ];

  const taskReasonings = [
    "Store has not ordered {product} in 14 days. Historical average is 7-day reorder cycle. Push 2 cases to prevent competitor fill.",
    "MSL gap detected: store is missing {count} of 12 must-stock items in Gold tier. Focus on top 3 by margin.",
    "Store has been inactive for 21 days. Last purchase was Rs {value}. Risk of competitor capture — visit to reactivate.",
    "Store consistently orders 5 cases of {product}. Based on similar stores, upsell potential of 3 additional cases (60% uplift).",
    "Customers buying {product1} also purchase {product2} in 73% of similar stores. Cross-sell opportunity worth Rs {value}.",
    "New launch: {product} launched 2 weeks ago. Store matches target demographic. Introductory offer available (10% off).",
  ];

  const pitches = [
    "Sir, aapka {product} ka stock 14 din pehle khatam hua. 2 case rakh lo — weekly 3 case bikta hai aapke yahan.",
    "Aapki dukaan Gold tier hai par 3 important items missing hain. Ye customers dusri dukaan chale jaate hain. Chalo stock bharte hain.",
    "Aapne 21 din se order nahi diya. Competition wale aa rahe hain — special offer hai aapke liye: 5% extra margin on first order.",
    "Aap har week 5 case lete ho. Par aapke area mein similar stores 8 case bech rahe hain. 3 extra try karo — margin badhega.",
    "Jo customers {product1} lete hain, 73% log {product2} bhi chahte hain. Saath mein rakhoge toh dono ki sale badhegi.",
    "Naya product launch hua hai — {product}. Aapke area mein demand aa rahi hai. 10% introductory offer hai.",
  ];

  // Create 200 tasks (across last 7 days for all reps)
  let taskCount = 0;
  const taskRecords: Array<{ id: string; repId: string }> = [];

  for (let day = 0; day < 7; day++) {
    const taskDate = new Date();
    taskDate.setDate(taskDate.getDate() - day);
    taskDate.setHours(0, 0, 0, 0);

    for (const rep of repRecords) {
      const tasksForDay = randomInt(2, 5);
      for (let t = 0; t < tasksForDay && taskCount < 200; t++) {
        const store = randomElement(storeRecords);
        const taskType = randomElement(taskTypes);
        const priorityScore = randomInt(30, 100);
        const status = day > 2
          ? randomElement(["COMPLETED", "SKIPPED", "EXPIRED"] as const)
          : day > 0
            ? randomElement(["COMPLETED", "PENDING", "SKIPPED"] as const)
            : "PENDING";

        const selectedProducts = Array.from(
          { length: randomInt(1, 3) },
          () => randomElement(productRecords).id
        );

        const task = await prisma.task.create({
          data: {
            storeId: store.id,
            repId: rep.id,
            companyId: COMPANY_ID,
            taskDate,
            taskType,
            productIds: selectedProducts,
            priorityScore,
            status,
            completedAt: status === "COMPLETED" ? addDays(taskDate, 0) : null,
            rewardPoints: status === "COMPLETED" ? randomInt(5, 25) : 0,
            aiReasoning: randomElement(taskReasonings)
              .replace("{product}", randomElement(productData).name)
              .replace("{product1}", randomElement(productData).name)
              .replace("{product2}", randomElement(productData).name)
              .replace("{count}", String(randomInt(2, 5)))
              .replace("{value}", String(randomInt(1000, 15000))),
            suggestedPitch: randomElement(pitches)
              .replace("{product}", randomElement(productData).name)
              .replace("{product1}", randomElement(productData).name)
              .replace("{product2}", randomElement(productData).name),
            estimatedImpact: new Prisma.Decimal(randomDecimal(500, 15000)),
          },
        });
        taskRecords.push({ id: task.id, repId: rep.id });
        taskCount++;
      }
    }
  }
  console.log(`  Created ${taskCount} AI tasks.`);

  // Create 100 visits (over last 14 days)
  let visitCount = 0;
  for (let i = 0; i < 100; i++) {
    const store = STORES[i % STORES.length];
    const storeRec = storeRecords[i % storeRecords.length];
    const rep = randomElement(repRecords);
    const checkInTime = randomDate(14);
    const durationMin = randomInt(5, 45);
    const checkOutTime = new Date(checkInTime.getTime() + durationMin * 60 * 1000);

    // Slight GPS jitter for check-in/out
    const latJitter = () => (Math.random() - 0.5) * 0.0005;
    const lngJitter = () => (Math.random() - 0.5) * 0.0005;

    await prisma.visit.create({
      data: {
        storeId: storeRec.id,
        repId: rep.id,
        companyId: COMPANY_ID,
        checkInTime,
        checkOutTime,
        checkInLat: new Prisma.Decimal(+(store.lat + latJitter()).toFixed(7)),
        checkInLng: new Prisma.Decimal(+(store.lng + lngJitter()).toFixed(7)),
        checkOutLat: new Prisma.Decimal(+(store.lat + latJitter()).toFixed(7)),
        checkOutLng: new Prisma.Decimal(+(store.lng + lngJitter()).toFixed(7)),
        durationMinutes: durationMin,
        photos: [],
        notes: randomElement([
          "Store well-stocked. Owner interested in new launches.",
          "Competitor product prominently displayed. Need shelf share improvement.",
          "Good visit. Placed reorder for 3 SKUs.",
          "Owner not available. Spoke with manager. Will follow up tomorrow.",
          "MSL compliance improved from 60% to 80%. Good progress.",
          "Store undergoing renovation. Limited shelf space currently.",
          null,
        ]),
      },
    });
    visitCount++;
  }
  console.log(`  Created ${visitCount} visits.`);

  // Create 50 eB2B orders
  const eb2bStatuses: Array<"PENDING" | "CONFIRMED" | "PROCESSING" | "DISPATCHED" | "DELIVERED" | "CANCELLED"> = [
    "PENDING", "CONFIRMED", "PROCESSING", "DISPATCHED", "DELIVERED", "DELIVERED", "DELIVERED", "CANCELLED",
  ];
  const eb2bChannels: Array<"WHATSAPP" | "PWA" | "APP" | "VOICE"> = ["WHATSAPP", "WHATSAPP", "WHATSAPP", "PWA", "PWA", "APP", "VOICE"];

  let eb2bCount = 0;
  for (let i = 0; i < 50; i++) {
    const store = randomElement(storeRecords);
    const orderItems = Array.from({ length: randomInt(2, 6) }, () => {
      const prod = randomElement(productData);
      const qty = randomInt(1, 12);
      return {
        skuCode: prod.skuCode,
        name: prod.name,
        quantity: qty,
        unitPrice: prod.distributorPrice,
        lineTotal: +(prod.distributorPrice * qty).toFixed(2),
      };
    });
    const totalValue = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const channel = randomElement(eb2bChannels);

    await prisma.orderEb2b.create({
      data: {
        storeId: store.id,
        companyId: COMPANY_ID,
        items: orderItems,
        totalValue: new Prisma.Decimal(+totalValue.toFixed(2)),
        status: randomElement(eb2bStatuses),
        channel,
        whatsappMsgId: channel === "WHATSAPP" ? `wamid.${uuid().replace(/-/g, "")}` : null,
        deliveryEta: addDays(new Date(), randomInt(1, 5)),
      },
    });
    eb2bCount++;
  }
  console.log(`  Created ${eb2bCount} eB2B orders.`);

  // Create 100 predictions
  const predTypes: Array<"DEMAND" | "STOCKOUT" | "ATTRITION" | "CREDIT"> = [
    "DEMAND", "DEMAND", "DEMAND", "STOCKOUT", "STOCKOUT", "ATTRITION", "CREDIT",
  ];
  let predCount = 0;
  for (let i = 0; i < 100; i++) {
    const store = randomElement(storeRecords);
    const product = randomElement(productRecords);
    const predType = randomElement(predTypes);

    let predictedValue: number;
    switch (predType) {
      case "DEMAND":
        predictedValue = randomDecimal(5, 100, 1); // units
        break;
      case "STOCKOUT":
        predictedValue = randomDecimal(0.1, 0.95, 4); // probability
        break;
      case "ATTRITION":
        predictedValue = randomDecimal(0.05, 0.8, 4); // probability
        break;
      case "CREDIT":
        predictedValue = randomDecimal(1, 4, 1); // tier score
        break;
    }

    await prisma.prediction.create({
      data: {
        storeId: store.id,
        productId: product.id,
        companyId: COMPANY_ID,
        predictionType: predType,
        predictedValue: new Prisma.Decimal(predictedValue),
        confidence: new Prisma.Decimal(randomDecimal(0.65, 0.98, 4)),
        predictionDate: new Date(),
        validUntil: addDays(new Date(), predType === "DEMAND" ? 7 : 30),
        modelVersion: `v1.0.${randomInt(1, 5)}`,
      },
    });
    predCount++;
  }
  console.log(`  Created ${predCount} predictions.`);

  // -------------------------------------------------------------------------
  // 9. Create Incentives for completed tasks
  // -------------------------------------------------------------------------
  console.log("\n[9/9] Creating incentives for completed tasks...");
  const completedTasks = taskRecords.filter(() => Math.random() > 0.5);
  let incentiveCount = 0;

  const incentiveReasons = [
    "Task completed on time — store visit verified via GPS",
    "Order placed successfully during visit",
    "MSL compliance improved by 20%+ at store",
    "New product successfully placed at store",
    "Reactivated dormant store — first order in 21+ days",
    "Achieved upsell target — 50%+ uplift over average",
    "Cross-sell success — new category introduced at store",
    "Store owner feedback: excellent service rating",
  ];

  for (const task of completedTasks.slice(0, 80)) {
    try {
      const points = randomInt(5, 25);
      await prisma.incentive.create({
        data: {
          repId: task.repId,
          companyId: COMPANY_ID,
          taskId: task.id,
          pointsEarned: points,
          reason: randomElement(incentiveReasons),
          awardedAt: randomDate(7),
        },
      });
      incentiveCount++;
    } catch {
      // Skip duplicate taskId (unique constraint)
    }
  }
  console.log(`  Created ${incentiveCount} incentives.\n`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const counts = {
    tenants: await prisma.tenant.count(),
    companies: await prisma.company.count(),
    stores: await prisma.store.count(),
    products: await prisma.product.count(),
    reps: await prisma.rep.count(),
    transactions: await prisma.transaction.count(),
    transactionItems: await prisma.transactionItem.count(),
    tasks: await prisma.task.count(),
    visits: await prisma.visit.count(),
    ordersEb2b: await prisma.orderEb2b.count(),
    predictions: await prisma.prediction.count(),
    incentives: await prisma.incentive.count(),
  };

  console.log("=============================================================");
  console.log("  Seed Complete! Summary:");
  console.log("=============================================================");
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(20)} ${count}`);
  }
  console.log("=============================================================\n");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
seed()
  .then(() => {
    console.log("Seeding finished successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
