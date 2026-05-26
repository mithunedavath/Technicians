"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { collection, query } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Map, MapPin, Building2, User, Phone, CheckCircle2, AlertTriangle, RefreshCw, Layers, ShieldCheck, MapPinned, Globe, Eye, PhoneCall, Mail, DollarSign, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

// Common geocoding table for vendors' coverage mapping
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "DELHI": { lat: 28.6139, lng: 77.2090 },
  "GURUGRAM": { lat: 28.4595, lng: 77.0266 },
  "NOIDA": { lat: 28.5355, lng: 77.3910 },
  "GHAZIABAD": { lat: 28.6692, lng: 77.4538 },
  "FARIDABAD": { lat: 28.4089, lng: 77.3178 },
  "ROHTAK": { lat: 28.8955, lng: 76.6066 },
  "SONIPAT": { lat: 28.9931, lng: 77.0151 },
  "REWARI": { lat: 28.1835, lng: 76.6026 },
  "AMBALA": { lat: 30.3782, lng: 76.7767 },
  "PANIPAT": { lat: 29.3909, lng: 76.9635 },
  "KARNAL": { lat: 29.6857, lng: 76.9905 },
  "HISAR": { lat: 29.1492, lng: 75.7217 },
  "BHIWANI": { lat: 28.7831, lng: 76.1398 },
  "SIRSA": { lat: 29.5312, lng: 75.0332 },
  "LUCKNOW": { lat: 26.8467, lng: 80.9462 },
  "KANPUR": { lat: 26.4499, lng: 80.3319 },
  "PUNE": { lat: 18.5204, lng: 73.8567 },
  "MUMBAI": { lat: 19.0760, lng: 72.8777 },
  "NAGPUR": { lat: 21.1458, lng: 79.0882 },
  "BENGALURU": { lat: 12.9716, lng: 77.5946 },
  "CHENNAI": { lat: 13.0827, lng: 80.2707 },
  "KOLKATA": { lat: 22.5726, lng: 88.3639 },
  "HYDERABAD": { lat: 17.3850, lng: 78.4867 },
  "JAIPUR": { lat: 26.9124, lng: 75.7873 },
  "AHMEDABAD": { lat: 23.0225, lng: 72.5714 }
};

// Map center parameters
const STATE_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  "ALL INDIA": { lat: 22.9734, lng: 78.6569, zoom: 5 },
  "DELHI": { lat: 28.6139, lng: 77.2090, zoom: 10 },
  "HARYANA": { lat: 29.0588, lng: 76.0856, zoom: 8 },
  "UTTAR PRADESH": { lat: 26.8467, lng: 80.9462, zoom: 7 },
  "MAHARASHTRA": { lat: 19.7515, lng: 75.7139, zoom: 7 }
};

// District presets
const STATE_DISTRICTS_PRESETS: Record<string, string[]> = {
  "DELHI": [
    "Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", 
    "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"
  ],
  "HARYANA": [
    "Gurugram", "Faridabad", "Rohtak", "Sonipat", "Rewari", "Ambala", "Bhiwani", "Charkhi Dadri", 
    "Fatehabad", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", 
    "Nuh", "Palwal", "Panchkula", "Panipat", "Sirsa", "Yamunanagar"
  ],
  "UTTAR PRADESH": [
    "Noida", "Ghaziabad", "Lucknow", "Kanpur", "Agra", "Varanasi", "Meerut", "Bulandshahr", "Hapur", "Muzaffarnagar"
  ],
  "MAHARASHTRA": [
    "Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", 
    "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", 
    "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", 
    "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", 
    "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"
  ]
};

// All India SVG boundaries coordinates
const SVG_INDIA_PATHS = [
  { id: "JK", name: "Jammu & Kashmir", d: "M 230,80 L 260,60 L 290,70 L 305,100 L 280,130 L 230,120 Z" },
  { id: "LA", name: "Ladakh", d: "M 290,70 L 330,40 L 380,60 L 360,110 L 305,100 Z" },
  { id: "HP", name: "Himachal Pradesh", d: "M 280,130 L 305,100 L 360,110 L 340,150 L 300,165 Z" },
  { id: "PB", name: "Punjab", d: "M 220,150 L 280,130 L 300,165 L 260,195 L 220,185 Z" },
  { id: "UK", name: "Uttarakhand", d: "M 340,150 L 385,160 L 400,200 L 350,215 L 340,180 Z" },
  { id: "HR", name: "Haryana", d: "M 260,195 L 300,165 L 340,180 L 335,225 L 290,240 L 265,220 Z" },
  { id: "DL", name: "Delhi", d: "M 320,210 A 10,10 0 1,1 320,210.1 Z" },
  { id: "RJ", name: "Rajasthan", d: "M 150,220 L 265,220 L 290,240 L 305,320 L 210,340 L 160,280 Z" },
  { id: "GJ", name: "Gujarat", d: "M 110,350 L 180,340 L 205,360 L 180,440 L 120,430 L 105,390 Z" },
  { id: "MP", name: "Madhya Pradesh", d: "M 210,340 L 305,320 L 390,320 L 420,380 L 350,440 L 235,420 Z" },
  { id: "UP", name: "Uttar Pradesh", d: "M 290,240 L 335,225 L 350,215 L 400,200 L 480,240 L 490,290 L 390,320 L 305,320 Z" },
  { id: "BR", name: "Bihar", d: "M 480,240 L 580,260 L 570,320 L 485,310 Z" },
  { id: "JH", name: "Jharkhand", d: "M 485,310 L 570,320 L 560,375 L 480,365 Z" },
  { id: "WB", name: "West Bengal", d: "M 570,320 L 610,310 L 595,430 L 560,400 Q 565,360 570,320 Z" },
  { id: "OD", name: "Odisha", d: "M 460,410 L 540,385 L 560,400 L 530,480 L 450,450 Z" },
  { id: "CG", name: "Chhattisgarh", d: "M 390,380 L 460,410 L 450,450 L 430,510 L 380,450 Z" },
  { id: "MH", name: "Maharashtra", d: "M 180,440 L 235,420 L 350,440 L 380,450 L 330,550 L 220,520 L 190,470 Z" },
  { id: "TG", name: "Telangana", d: "M 330,550 L 385,530 L 400,580 L 350,620 L 320,590 Z" },
  { id: "AP", name: "Andhra Pradesh", d: "M 380,510 L 430,510 L 450,450 L 400,580 L 380,680 L 340,680 Q 350,610 380,510 Z" },
  { id: "KA", name: "Karnataka", d: "M 220,520 L 320,590 L 340,680 L 315,750 L 250,710 L 245,600 Z" },
  { id: "GA", name: "Goa", d: "M 240,600 L 255,600 L 250,615 L 238,610 Z" },
  { id: "KL", name: "Kerala", d: "M 270,740 L 300,750 L 290,830 L 270,820 Z" },
  { id: "TN", name: "Tamil Nadu", d: "M 315,750 L 360,740 L 340,840 L 290,830 Z" },
  { id: "SK", name: "Sikkim", d: "M 590,230 L 610,230 L 605,250 L 585,250 Z" },
  { id: "AS", name: "Assam", d: "M 630,250 L 690,240 L 710,270 L 670,290 L 640,285 Z" },
  { id: "AR", name: "Arunachal Pradesh", d: "M 670,220 L 740,210 L 750,250 L 690,240 Z" },
  { id: "NL", name: "Nagaland", d: "M 725,250 L 750,255 L 745,280 L 720,270 Z" },
  { id: "MN", name: "Manipur", d: "M 715,280 L 740,285 L 735,310 L 710,305 Z" },
  { id: "MZ", name: "Mizoram", d: "M 705,315 L 725,315 L 715,350 L 700,340 Z" },
  { id: "TR", name: "Tripura", d: "M 685,305 L 705,305 L 700,325 L 685,320 Z" },
  { id: "ML", name: "Meghalaya", d: "M 630,270 L 670,270 L 665,290 L 625,290 Z" }
];

// Stylized geometric high-fidelity SVG path layout representing district-level political boundaries
const HARYANA_DISTRICTS_SVG = [
  { id: "PANCHKULA", name: "Panchkula", d: "M 310,20 L 350,10 L 360,50 L 330,60 Z" },
  { id: "AMBALA", name: "Ambala", d: "M 300,60 L 330,60 L 350,100 L 290,100 Z" },
  { id: "YAMUNANAGAR", name: "Yamunanagar", d: "M 350,60 L 400,70 L 390,120 L 350,100 Z" },
  { id: "KURUKSHETRA", name: "Kurukshetra", d: "M 260,100 L 290,100 L 350,100 L 320,130 L 260,120 Z" },
  { id: "KAITHAL", name: "Kaithal", d: "M 210,120 L 260,120 L 320,130 L 280,170 L 200,160 Z" },
  { id: "KARNAL", name: "Karnal", d: "M 320,130 L 370,120 L 380,170 L 340,190 L 300,170 Z" },
  { id: "PANIPAT", name: "Panipat", d: "M 340,190 L 380,190 L 375,230 L 320,230 Z" },
  { id: "SONIPAT", name: "Sonipat", d: "M 320,230 L 375,230 L 370,280 L 340,290 L 310,275 Z" },
  { id: "JIND", name: "Jind", d: "M 230,160 L 300,170 L 320,230 L 280,255 L 210,210 Z" },
  { id: "FATEHABAD", name: "Fatehabad", d: "M 120,150 L 200,160 L 210,210 L 170,220 L 130,200 Z" },
  { id: "SIRSA", name: "Sirsa", d: "M 30,150 L 120,150 L 130,200 L 100,230 L 50,210 Z" },
  { id: "HISAR", name: "Hisar", d: "M 130,200 L 210,210 L 230,260 L 190,300 L 150,280 Z" },
  { id: "BHIWANI", name: "Bhiwani", d: "M 190,300 L 230,260 L 260,275 L 240,350 L 170,350 Z" },
  { id: "CHARKHI DADRI", name: "Charkhi Dadri", d: "M 240,350 L 260,340 L 280,360 L 260,390 L 225,385 Z" },
  { id: "ROHTAK", name: "Rohtak", d: "M 280,255 L 320,230 L 310,275 L 280,310 L 250,290 Z" },
  { id: "JHAJJAR", name: "Jhajjar", d: "M 280,310 L 310,275 L 330,290 L 320,350 L 280,360 Z" },
  { id: "DELHI", name: "Delhi", d: "M 335,280 L 355,280 L 355,300 L 335,300 Z" },
  { id: "GURUGRAM", name: "Gurugram", d: "M 320,350 L 330,290 L 355,300 L 365,350 L 330,370 Z" },
  { id: "FARIDABAD", name: "Faridabad", d: "M 365,350 L 390,340 L 395,380 L 360,385 Z" },
  { id: "PALWAL", name: "Palwal", d: "M 360,385 L 395,380 L 390,440 L 350,430 Z" },
  { id: "NUH", name: "Nuh", d: "M 330,370 L 365,350 L 360,385 L 350,430 L 315,430 Z" },
  { id: "REWARI", name: "Rewari", d: "M 280,360 L 320,350 L 330,370 L 315,430 L 275,400 Z" },
  { id: "MAHENDRAGARH", name: "Mahendragarh", d: "M 225,385 L 275,400 L 260,470 L 210,430 Z" }
];

const DELHI_DISTRICTS_SVG = [
  { id: "NORTH WEST DELHI", name: "North West Delhi", d: "M 80,80 L 200,80 L 220,200 L 120,240 L 70,160 Z" },
  { id: "NORTH DELHI", name: "North Delhi", d: "M 200,80 L 280,100 L 260,200 L 220,200 Z" },
  { id: "NORTH EAST DELHI", name: "North East Delhi", d: "M 280,100 L 355,120 L 330,200 L 260,200 Z" },
  { id: "WEST DELHI", name: "West Delhi", d: "M 70,160 L 120,240 L 190,240 L 170,300 L 80,280 Z" },
  { id: "CENTRAL DELHI", name: "Central Delhi", d: "M 220,200 L 260,200 L 260,245 L 200,245 L 190,240 Z" },
  { id: "EAST DELHI", name: "East Delhi", d: "M 260,200 L 330,200 L 340,270 L 270,270 Z" },
  { id: "SHAHDARA", name: "Shahdara", d: "M 330,200 L 390,180 L 400,250 L 340,270 Z" },
  { id: "NEW DELHI", name: "New Delhi", d: "M 190,240 L 200,245 L 260,245 L 275,270 L 240,320 L 180,295 Z" },
  { id: "SOUTH WEST DELHI", name: "South West Delhi", d: "M 80,280 L 170,300 L 180,295 L 240,320 L 200,430 L 120,400 Z" },
  { id: "SOUTH DELHI", name: "South Delhi", d: "M 240,320 L 290,320 L 280,430 L 200,430 Z" },
  { id: "SOUTH EAST DELHI", name: "South East Delhi", d: "M 270,270 Q 300,290 330,320 L 310,410 L 280,430 L 290,320 Z" }
];

const UP_DISTRICTS_SVG = [
  { id: "NOIDA", name: "Noida (Gautam Buddha Nagar)", d: "M 100,180 L 160,190 L 150,240 L 90,230 Z" },
  { id: "GHAZIABAD", name: "Ghaziabad", d: "M 90,130 L 150,140 L 160,190 L 100,180 Z" },
  { id: "MEERUT", name: "Meerut", d: "M 110,70 L 170,80 L 180,130 L 140,130 L 90,130 Z" },
  { id: "BULANDSHAHR", name: "Bulandshahr", d: "M 150,240 L 210,240 L 200,310 L 130,290 Z" },
  { id: "HAPUR", name: "Hapur", d: "M 150,140 L 190,145 L 210,190 L 160,190 Z" },
  { id: "MUZAFFARNAGAR", name: "Muzaffarnagar", d: "M 120,10 L 180,20 L 170,70 L 110,70 Z" },
  { id: "LUCKNOW", name: "Lucknow", d: "M 320,280 L 370,290 L 360,340 L 310,330 Z" },
  { id: "KANPUR", name: "Kanpur", d: "M 270,320 L 310,330 L 300,390 L 250,370 Z" },
  { id: "AGRA", name: "Agra", d: "M 110,330 L 160,340 L 150,390 L 90,380 Z" },
  { id: "VARANASI", name: "Varanasi", d: "M 440,380 L 490,390 L 480,440 L 430,430 Z" }
];

// Parser function to extract numbers from any SVG path string and return coordinate pairs
function parseSvgPathToPoints(pathD: string): [number, number][] {
  const matches = pathD.match(/[-+]?[0-9]*\.?[0-9]+/g);
  if (!matches) return [];
  const points: [number, number][] = [];
  for (let i = 0; i < matches.length; i += 2) {
    if (matches[i] !== undefined && matches[i+1] !== undefined) {
      points.push([parseFloat(matches[i]), parseFloat(matches[i+1])]);
    }
  }
  return points;
}

// Projection algorithm to convert SVG vector coordinates into real Geographical Lat/Lng coordinates for Leaflet
function projectSvgPointsToLatLng(points: [number, number][], stateName: string): [number, number][] {
  if (stateName === "ALL INDIA") {
    return points.map(([x, y]) => {
      const lat = 36.5 - (y - 40) * 0.041;
      const lng = 67.5 + (x - 20) * 0.0385;
      return [lat, lng];
    });
  }
  if (stateName === "HARYANA") {
    return points.map(([x, y]) => {
      const lat = 30.6 - (y - 10) * 0.0092;
      const lng = 74.05 + (x - 30) * 0.0105;
      return [lat, lng];
    });
  }
  if (stateName === "DELHI") {
    return points.map(([x, y]) => {
      const lat = 28.89 - (y - 50) * 0.00125;
      const lng = 76.82 + (x - 40) * 0.00148;
      return [lat, lng];
    });
  }
  if (stateName === "UTTAR PRADESH") {
    return points.map(([x, y]) => {
      const lat = 29.7 - (y - 10) * 0.009;
      const lng = 76.8 + (x - 90) * 0.0102;
      return [lat, lng];
    });
  }
  return points.map(([x, y]) => [y, x]);
}

export function MapClient() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [selectedState, setSelectedState] = useState<string>("ALL INDIA");
  const [activeVendorFilter, setActiveVendorFilter] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  
  // Dual layout: "political" (crisp, solid vector plane SVG) or "hybrid" (Leaflet satellite hybrid map)
  const [mapTab, setMapTab] = useState<"political" | "hybrid">("political");
  const [leafletBaseLayer, setLeafletBaseLayer] = useState<"street" | "satellite">("satellite");
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapInstanceRef = useRef<any>(null);
  const leafletPolygonsGroupRef = useRef<any>(null);
  const leafletMarkersGroupRef = useRef<any>(null);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  // Fetch all vendors from Firestore
  const vendorsRef = useMemoFirebase(() => query(collection(db, "vendors")), [db]);
  const { data: vendors, isLoading: isVendorsLoading } = useCollection(vendorsRef);

  // Group and normalize state names
  const availableStates = useMemo(() => {
    if (!vendors) return [];
    const states = vendors.map(v => v.state?.toUpperCase().trim()).filter(Boolean);
    return [...new Set(states)].sort();
  }, [vendors]);

  // Filter vendors based on active selection (All India vs. Specific State)
  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    if (selectedState === "ALL INDIA") return vendors;
    return vendors.filter(v => v.state?.toUpperCase().trim() === selectedState);
  }, [vendors, selectedState]);

  // Assign distinct dynamic HSL colors to each vendor in the active selection
  const vendorColors = useMemo(() => {
    const colors: Record<string, { base: string, glow: string, bg: string, border: string }> = {};
    if (filteredVendors.length === 0) return colors;

    filteredVendors.forEach((vendor, index) => {
      const hue = (index * (360 / filteredVendors.length)) % 360;
      colors[vendor.id] = {
        base: `hsl(${hue}, 85%, 45%)`,
        glow: `hsl(${hue}, 90%, 55%, 0.35)`,
        bg: `hsl(${hue}, 95%, 96%)`,
        border: `hsl(${hue}, 70%, 80%)`,
      };
    });
    return colors;
  }, [filteredVendors]);

  // Map districts of the selected state to covering vendors
  const districtCoverage = useMemo(() => {
    const coverage: Record<string, { vendorId: string; vendorName: string; color: string; code: string }[]> = {};
    
    // Choose presets based on selected state
    let presetDistricts = STATE_DISTRICTS_PRESETS[selectedState] || [];
    const allDistrictsSet = new Set<string>(presetDistricts);
    
    if (selectedState !== "ALL INDIA") {
      filteredVendors.forEach(vendor => {
        if (!vendor.districtsCovered) return;
        const list = vendor.districtsCovered.split(",")
          .map((d: string) => d.trim())
          .filter(Boolean);
          
        list.forEach((d: string) => {
          allDistrictsSet.add(d);
        });
      });
    }

    const allDistricts = Array.from(allDistrictsSet).sort();

    // Map each district to the vendor(s) covering it
    allDistricts.forEach(district => {
      coverage[district] = [];
      filteredVendors.forEach(vendor => {
        if (!vendor.districtsCovered) return;
        const list = vendor.districtsCovered.split(",").map((d: string) => d.trim().toLowerCase());
        if (list.includes(district.toLowerCase())) {
          coverage[district].push({
            vendorId: vendor.id,
            vendorName: vendor.companyName,
            color: vendorColors[vendor.id]?.base || "#3b82f6",
            code: vendor.vendorCode
          });
        }
      });
    });

    return { coverage, allDistricts };
  }, [selectedState, filteredVendors, vendorColors]);

  // Calculate density of vendors per state for All-India density colors
  const stateVendorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!vendors) return counts;
    vendors.forEach(v => {
      const st = v.state?.toUpperCase().trim();
      if (st) counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [vendors]);

  const stats = useMemo(() => {
    const totalDistricts = districtCoverage.allDistricts.length;
    let coveredDistrictsCount = 0;
    Object.values(districtCoverage.coverage).forEach(v => {
      if (v.length > 0) coveredDistrictsCount++;
    });

    return {
      totalDistricts,
      coveredDistrictsCount,
      unservedDistrictsCount: totalDistricts - coveredDistrictsCount,
      coveragePercent: totalDistricts > 0 ? Math.round((coveredDistrictsCount / totalDistricts) * 100) : 0
    };
  }, [districtCoverage]);

  const handleStatePathClick = (stateName: string) => {
    const upper = stateName.toUpperCase();
    if (availableStates.includes(upper)) {
      setSelectedState(upper);
      setActiveVendorFilter(null);
      setSelectedDistrict(null);
      toast({
        title: `Showing ${stateName}`,
        description: `Switched view to isolated state political map of ${stateName}.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "No Coverage",
        description: `No registered service centers in ${stateName}.`,
      });
    }
  };

  // Get active boundaries dataset based on state selection
  const activeBoundaryDataset = useMemo(() => {
    if (selectedState === "ALL INDIA") {
      return SVG_INDIA_PATHS;
    }
    if (selectedState === "HARYANA") return HARYANA_DISTRICTS_SVG;
    if (selectedState === "DELHI") return DELHI_DISTRICTS_SVG;
    if (selectedState === "UTTAR PRADESH") return UP_DISTRICTS_SVG;
    return null;
  }, [selectedState]);

  // Selected district details
  const selectedDistrictVendors = useMemo(() => {
    if (!selectedDistrict || !districtCoverage.coverage[selectedDistrict]) return [];
    const vendorsList = districtCoverage.coverage[selectedDistrict];
    return filteredVendors.filter(v => vendorsList.some(vl => vl.vendorId === v.id));
  }, [selectedDistrict, districtCoverage, filteredVendors]);

  // Ref value helper to allow Leaflet event handlers to access active values
  const refsHelper = useRef({ setSelectedState, setSelectedDistrict, selectedDistrict });
  useEffect(() => {
    refsHelper.current = { setSelectedState, setSelectedDistrict, selectedDistrict };
  }, [setSelectedState, setSelectedDistrict, selectedDistrict]);

  // Trigger window print dialog
  const handlePrintMap = () => {
    window.print();
  };

  // Initialize and update the Leaflet Hybrid/Satellite Map (Only runs when "hybrid" tab is active)
  useEffect(() => {
    if (mapTab !== "hybrid" || typeof window === "undefined" || !mapContainerRef.current) {
      if (leafletMapInstanceRef.current) {
        leafletMapInstanceRef.current.remove();
        leafletMapInstanceRef.current = null;
        leafletPolygonsGroupRef.current = null;
        leafletMarkersGroupRef.current = null;
      }
      return;
    }

    const L = require("leaflet");

    // Dynamic Leaflet CSS Injection
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Instantiation
    if (!leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      });
      leafletPolygonsGroupRef.current = L.featureGroup().addTo(leafletMapInstanceRef.current);
      leafletMarkersGroupRef.current = L.featureGroup().addTo(leafletMapInstanceRef.current);
    }

    const map = leafletMapInstanceRef.current;

    // Base tiles render (OSM streets vs Satellite Hybrid)
    map.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });

    if (leafletBaseLayer === "street") {
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(map);
    } else {
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18
      }).addTo(map);
      
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
        maxZoom: 20
      }).addTo(map);
    }

    // Clear previous geometries
    leafletPolygonsGroupRef.current.clearLayers();
    leafletMarkersGroupRef.current.clearLayers();

    // 1. Draw boundary polygons directly on the Satellite Map
    if (activeBoundaryDataset) {
      activeBoundaryDataset.forEach(boundary => {
        const svgPoints = parseSvgPathToPoints(boundary.d);
        const geoPoints = projectSvgPointsToLatLng(svgPoints, selectedState);
        
        if (geoPoints.length === 0) return;

        const nameKey = boundary.name.toUpperCase();
        const isSelected = refsHelper.current.selectedDistrict === nameKey;

        let fillColor = "#64748b";
        let isCovered = false;
        let strokeColor = "#334155";
        let titleContent = "";

        if (selectedState === "ALL INDIA") {
          const density = stateVendorCounts[nameKey] || 0;
          isCovered = density > 0;
          if (isCovered) {
            if (density === 1) fillColor = "#10b981";
            else if (density <= 3) fillColor = "#059669";
            else fillColor = "#047857";
          }
          strokeColor = "#ffffff";
          titleContent = `${boundary.name} (${density} Center${density > 1 ? 's' : ''})`;
        } else {
          const coveringVendors = districtCoverage.coverage[nameKey] || [];
          isCovered = coveringVendors.length > 0;
          
          if (isCovered) {
            const firstVendor = coveringVendors[0];
            fillColor = vendorColors[firstVendor.vendorId]?.base || "#3b82f6";
            strokeColor = vendorColors[firstVendor.vendorId]?.base || "#2563eb";
          } else {
            fillColor = "#94a3b8";
            strokeColor = "#cbd5e1";
          }
          titleContent = `${boundary.name} ${isCovered ? `(Covered by: ${coveringVendors.map(v => v.code).join(", ")})` : "(Unserved)"}`;
        }

        if (isSelected) {
          strokeColor = "#2563eb";
        }

        const polygon = L.polygon(geoPoints, {
          color: strokeColor,
          weight: isSelected ? 3 : 1.2,
          fillColor: fillColor,
          fillOpacity: isCovered ? 0.22 : 0.06,
          className: "interactive-map-polygon"
        });

        // Hover events
        polygon.on("mouseover", function (e: any) {
          e.target.setStyle({
            fillOpacity: isCovered ? 0.35 : 0.15,
            weight: isSelected ? 3.5 : 2.0
          });
        });

        polygon.on("mouseout", function (e: any) {
          e.target.setStyle({
            fillOpacity: isCovered ? 0.22 : 0.06,
            weight: isSelected ? 3 : 1.2
          });
        });

        // Click events
        polygon.on("click", function () {
          if (selectedState === "ALL INDIA") {
            refsHelper.current.setSelectedState(nameKey);
            refsHelper.current.setSelectedDistrict(null);
          } else {
            const alreadySelected = refsHelper.current.selectedDistrict === nameKey;
            refsHelper.current.setSelectedDistrict(alreadySelected ? null : nameKey);
          }
        });

        polygon.bindTooltip(titleContent, { sticky: true, className: "text-xs font-bold font-sans" });
        leafletPolygonsGroupRef.current.addLayer(polygon);
      });
    }

    // 2. Plot active vendor pins & coverage circles
    filteredVendors.forEach(vendor => {
      const cityKey = (vendor.city || "").toUpperCase().trim();
      const coords = CITY_COORDINATES[cityKey] || CITY_COORDINATES["DELHI"];

      if (!coords) return;

      const colorSet = vendorColors[vendor.id] || { base: "#3b82f6", glow: "rgba(59, 130, 246, 0.3)" };
      const isFiltered = activeVendorFilter ? activeVendorFilter === vendor.id : true;

      if (!isFiltered) return;

      const customMarkerIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `<div style="background-color: ${colorSet.base}; border: 2px solid white; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);" class="animate-bounce"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker([coords.lat, coords.lng], { icon: customMarkerIcon });
      
      marker.bindPopup(`
        <div class="p-2 space-y-1 text-slate-800 text-xs font-sans">
          <strong style="color: ${colorSet.base}; font-size: 13px;">${vendor.companyName}</strong><br/>
          <strong>Code:</strong> ${vendor.vendorCode}<br/>
          <strong>Phone:</strong> ${vendor.contactNumber || 'N/A'}
        </div>
      `);

      const circle = L.circle([coords.lat, coords.lng], {
        color: colorSet.base,
        fillColor: colorSet.base,
        fillOpacity: 0.15,
        radius: 35000 
      });

      leafletMarkersGroupRef.current.addLayer(marker);
      leafletMarkersGroupRef.current.addLayer(circle);
    });

    // 3. Zoom / Fit Map bounds precisely
    if (selectedState === "ALL INDIA") {
      map.setView([STATE_CENTERS["ALL INDIA"].lat, STATE_CENTERS["ALL INDIA"].lng], STATE_CENTERS["ALL INDIA"].zoom);
    } else {
      const bounds = leafletPolygonsGroupRef.current.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
      } else {
        const fallback = STATE_CENTERS[selectedState] || STATE_CENTERS["DELHI"];
        map.setView([fallback.lat, fallback.lng], fallback.zoom);
      }
    }

  }, [mapTab, selectedState, activeBoundaryDataset, filteredVendors, vendorColors, leafletBaseLayer, activeVendorFilter, stateVendorCounts, districtCoverage, selectedDistrict]);

  if (!mounted || isUserLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-4 bg-slate-50/50 rounded-2xl border">
        <RefreshCw className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Loading command center dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      
      {/* Dynamic Global Print Media Style Sheet Injection */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          /* Hide everything except the print map container */
          body * {
            visibility: hidden;
          }
          #printable-map-area, #printable-map-area * {
            visibility: visible;
          }
          #printable-map-area {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background-color: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          .print-title {
            display: block !important;
            font-size: 22px !important;
            font-weight: 800 !important;
            color: #1e3a8a !important;
            margin-bottom: 15px !important;
            border-bottom: 2px solid #cbd5e1 !important;
            padding-bottom: 8px !important;
          }
          .print-legend {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 10px !important;
            margin-top: 20px !important;
            border-top: 2px solid #cbd5e1 !important;
            padding-top: 12px !important;
          }
          .print-legend-item {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            font-size: 10px !important;
            color: #334155 !important;
          }
          .page-break-before-always {
            page-break-before: always !important;
          }
        }
      `}</style>
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <MapPinned className="h-8 w-8 text-primary" /> State Coverage Mapping
          </h1>
          <p className="text-muted-foreground">
            Visualize your regional technician force, service centers, and coverage territories in real-time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <span className="text-xs uppercase font-bold text-muted-foreground whitespace-nowrap">Filter View:</span>
          <Select value={selectedState} onValueChange={(val) => { setSelectedState(val); setActiveVendorFilter(null); setSelectedDistrict(null); }}>
            <SelectTrigger className="w-[200px] border-primary/20 hover:border-primary/50 shadow-md bg-white">
              <SelectValue placeholder="Select boundary map" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="ALL INDIA">🌐 ALL INDIA VIEW</SelectItem>
              {availableStates.map(state => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Toggle Map Mode */}
          <div className="flex rounded-lg border bg-slate-100 p-0.5 shadow-sm text-xs font-bold">
            <button 
              onClick={() => setMapTab("political")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all ${
                mapTab === "political" 
                  ? "bg-white text-primary shadow" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" /> Political Map (Flat SVG)
            </button>
            <button 
              disabled={isVendorsLoading}
              onClick={() => setMapTab("hybrid")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all ${
                mapTab === "hybrid" 
                  ? "bg-white text-primary shadow" 
                  : "text-slate-500 hover:text-slate-800 disabled:opacity-50"
              }`}
            >
              <Globe className="h-3.5 w-3.5" /> Satellite Hybrid Map
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Section: Clean SVG Political Map or Leaflet Satellite Map */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          <Card 
            id="printable-map-area" 
            className="shadow-lg border-primary/10 bg-white overflow-hidden flex flex-col min-h-[580px]"
          >
            {/* Printed Page Header (Hidden on Web Screen) */}
            <div className="hidden print-title">
              <div className="flex justify-between items-center">
                <span>{selectedState === "ALL INDIA" ? "All India Vendor Coverage Political Map" : `${selectedState} Operations & Territory Coverage Map`}</span>
                <span className="text-[10px] text-slate-400 font-normal">Generated: {new Date().toLocaleDateString()}</span>
              </div>
              <div className="text-xs font-semibold text-slate-500 mt-1">
                Serviced Districts: {stats.coveredDistrictsCount} / {stats.totalDistricts} ({stats.coveragePercent}% coverage)
              </div>
            </div>

            <CardHeader className="bg-primary/5 border-b pb-4 flex flex-row items-center justify-between no-print">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  {mapTab === "political" ? (
                    <>
                      <Layers className="h-5 w-5 animate-pulse" />
                      {selectedState === "ALL INDIA" ? "All-India Political Boundary Map" : `${selectedState} Isolated Political Map`}
                    </>
                  ) : (
                    <>
                      <Globe className="h-5 w-5 text-emerald-600 animate-spin-slow" />
                      {selectedState === "ALL INDIA" ? "All-India Geographical Overlay" : `${selectedState} Geographical Hybrid Map`}
                    </>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {mapTab === "political" 
                    ? "Flat vector boundaries ideal for easy visual marking, zone highlights, and perfect PDF printing." 
                    : "Live interactive coordinate mapping with service coverage zones."
                  }
                </CardDescription>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {mapTab === "political" && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handlePrintMap}
                    className="border-primary/20 hover:bg-primary/5 text-primary text-xs flex items-center gap-1.5 shadow"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print Area Map
                  </Button>
                )}
                {mapTab === "hybrid" && (
                  <div className="flex border rounded-lg overflow-hidden text-[10px] font-bold bg-white shadow-sm">
                    <button 
                      onClick={() => setLeafletBaseLayer("street")} 
                      className={`px-2.5 py-1 ${leafletBaseLayer === "street" ? "bg-slate-200 text-slate-800" : "text-slate-400 hover:bg-slate-50"}`}
                    >
                      Streets
                    </button>
                    <button 
                      onClick={() => setLeafletBaseLayer("satellite")} 
                      className={`px-2.5 py-1 ${leafletBaseLayer === "satellite" ? "bg-slate-200 text-slate-800" : "text-slate-400 hover:bg-slate-50"}`}
                    >
                      Satellite
                    </button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex items-center justify-center p-4 relative bg-slate-50/20 min-h-[480px]">
              {mapTab === "political" ? (
                // LAYOUT: Flat crisp SVG Political map (Perfect for drawing and printing!)
                selectedState === "ALL INDIA" ? (
                  // All India Flat Vector SVG Outline
                  <svg 
                    viewBox="50 0 750 900" 
                    className="w-full h-full max-h-[550px] drop-shadow-lg"
                  >
                    <g stroke="#334155" strokeWidth="1.2" strokeLinejoin="round">
                      {SVG_INDIA_PATHS.map((path) => {
                        const density = stateVendorCounts[path.name.toUpperCase()] || 0;
                        const hasVendors = density > 0;
                        
                        let fill = "#f8fafc"; // Flat clean slate-50
                        
                        if (hasVendors) {
                          if (density === 1) fill = "#d1fae5"; // emerald-100
                          else if (density <= 3) fill = "#a7f3d0"; // emerald-200
                          else fill = "#6ee7b7"; // emerald-300
                        }

                        return (
                          <path
                            key={path.id}
                            d={path.d}
                            fill={fill}
                            className="transition-all duration-200 cursor-pointer hover:fill-blue-100"
                            onClick={() => handleStatePathClick(path.name)}
                          >
                            <title>
                              {`${path.name} ${density > 0 ? `(${density} Center${density > 1 ? 's' : ''})` : "(No Active Center)"}`}
                            </title>
                          </path>
                        );
                      })}
                    </g>
                  </svg>
                ) : (
                  // Isolated State Flat Vector SVG Outlines (Haryana / Delhi / UP)
                  activeBoundaryDataset ? (
                    <svg 
                      viewBox="0 0 450 500" 
                      className="w-full h-full max-h-[500px] drop-shadow-md"
                    >
                      <g stroke="#334155" strokeWidth="1.2" strokeLinejoin="round">
                        {activeBoundaryDataset.map((district) => {
                          const nameKey = district.name.toUpperCase();
                          const coveringVendors = districtCoverage.coverage[nameKey] || [];
                          const isCovered = coveringVendors.length > 0;
                          const isSelected = selectedDistrict === nameKey;
                          
                          // Style based on covering vendor
                          let fill = "#f8fafc"; // Flat Slate-50 default
                          let strokeColor = "#334155";
                          let strokeWidth = "1.2";
                          
                          if (isCovered) {
                            const firstVendor = coveringVendors[0];
                            fill = vendorColors[firstVendor.vendorId]?.base || "#e0f2fe";
                          } else {
                            fill = "#e2e8f0"; // slate-200 unserved flat fill
                          }
                          
                          if (isSelected) {
                            strokeColor = "#2563eb"; // Blue outline
                            strokeWidth = "2.8";
                          }

                          return (
                            <path
                              key={district.id}
                              d={district.d}
                              fill={fill}
                              stroke={strokeColor}
                              strokeWidth={strokeWidth}
                              className="transition-all duration-200 cursor-pointer hover:fill-blue-100"
                              onClick={() => setSelectedDistrict(isSelected ? null : nameKey)}
                            >
                              <title>
                                {`${district.name} ${isCovered ? `(Covered by: ${coveringVendors.map(v => v.code).join(", ")})` : "(Unserved)"}`}
                              </title>
                            </path>
                          );
                        })}
                      </g>
                    </svg>
                  ) : (
                    // Vector District Schematic Grid Map for other states (Maharashtra, Karnataka, etc.)
                    <div className="w-full flex flex-col gap-4 p-2 text-slate-800">
                      <div className="flex items-center justify-between text-xs text-slate-500 border-b pb-2 no-print">
                        <span className="font-bold flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5 text-primary animate-pulse" /> Schematic District Grid Map
                        </span>
                        <span className="font-semibold">{districtCoverage.allDistricts.length} Districts Total</span>
                      </div>
                      
                      {districtCoverage.allDistricts.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-h-[460px] overflow-y-auto pr-1 print:max-h-none print:overflow-visible">
                          {districtCoverage.allDistricts.map((district) => {
                            const nameKey = district.toUpperCase();
                            const coveringVendors = districtCoverage.coverage[nameKey] || [];
                            const isCovered = coveringVendors.length > 0;
                            const isSelected = selectedDistrict === nameKey;

                            let bgStyle: React.CSSProperties = {};
                            let borderClass = "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400";
                            let dotColor = "bg-slate-300";

                            if (isCovered) {
                              const firstVendor = coveringVendors[0];
                              const colors = vendorColors[firstVendor.vendorId];
                              bgStyle = { 
                                backgroundColor: isSelected ? colors?.base : colors?.bg,
                                borderColor: colors?.border,
                                color: isSelected ? "#ffffff" : "#0f172a"
                              };
                              borderClass = "border-solid shadow-sm hover:scale-[1.02] print:hover:scale-100";
                              dotColor = isSelected ? "bg-white" : "bg-emerald-500 animate-pulse";
                            } else {
                              if (isSelected) {
                                bgStyle = { backgroundColor: "#ef4444", borderColor: "#dc2626", color: "#ffffff" };
                                borderClass = "border-solid hover:scale-[1.02] print:hover:scale-100";
                                dotColor = "bg-white";
                              } else {
                                bgStyle = { backgroundColor: "#f8fafc", borderColor: "#e2e8f0", color: "#64748b" };
                              }
                            }

                            return (
                              <button
                                key={district}
                                onClick={() => setSelectedDistrict(isSelected ? null : nameKey)}
                                style={bgStyle}
                                className={`p-3 rounded-xl border text-left text-xs transition-all duration-200 cursor-pointer flex flex-col justify-between h-20 shadow-sm print:shadow-none ${borderClass}`}
                              >
                                <div className="flex justify-between items-start w-full gap-2">
                                  <span className="font-extrabold truncate uppercase tracking-tight text-[10px]">{district}</span>
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                                </div>
                                <div className="flex justify-between items-end w-full text-[9px] mt-2 font-medium">
                                  <span className="font-mono text-[8px]">{isCovered ? `CODE: ${coveringVendors.map(v => v.code).join(", ")}` : "UNSERVED"}</span>
                                  {isCovered && (
                                    <span className={isSelected ? "text-white/80" : "text-emerald-600 font-bold"}>Served</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-16 text-center bg-slate-50 border rounded-2xl">
                          <AlertTriangle className="h-8 w-8 text-amber-500 mb-2 animate-bounce" />
                          <p className="font-extrabold text-slate-800 text-sm">No Districts Registered</p>
                          <p className="text-[10px] text-slate-500 max-w-[240px] mt-1">
                            Please add covered districts in the Vendor Profile page or excel template to visualize regional coverage cards.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                )
              ) : (
                // LAYOUT: Live geographical Leaflet Satellite Hybrid map
                <div 
                  ref={mapContainerRef} 
                  className="absolute inset-0 w-full h-full z-10"
                />
              )}

              {/* Vector Map Legends (Printed & Web view synced) */}
              {mapTab === "political" && (
                selectedState === "ALL INDIA" ? (
                  <div className="absolute bottom-4 left-4 bg-white/95 border rounded-xl p-3 text-[10px] space-y-1 shadow z-20 print-legend">
                    <div className="font-bold text-muted-foreground uppercase text-[9px] mb-1 no-print">State Center Density</div>
                    <div className="flex items-center gap-2 print-legend-item">
                      <div className="w-3.5 h-3.5 bg-[#6ee7b7] rounded border border-slate-400" />
                      <span>High Density (4+ Centers)</span>
                    </div>
                    <div className="flex items-center gap-2 print-legend-item">
                      <div className="w-3.5 h-3.5 bg-[#a7f3d0] rounded border border-slate-400" />
                      <span>Medium Density (2-3 Centers)</span>
                    </div>
                    <div className="flex items-center gap-2 print-legend-item">
                      <div className="w-3.5 h-3.5 bg-[#d1fae5] rounded border border-slate-400" />
                      <span>Single Service Center</span>
                    </div>
                    <div className="flex items-center gap-2 print-legend-item">
                      <div className="w-3.5 h-3.5 bg-[#f8fafc] rounded border border-slate-400" />
                      <span className="text-muted-foreground">No Registered Centers</span>
                    </div>
                  </div>
                ) : (
                  // State Level Legend matching dynamic vendor colors
                  <div className="absolute bottom-4 left-4 bg-white/95 border rounded-xl p-3 text-[10px] space-y-1.5 shadow z-20 print-legend max-h-[140px] overflow-y-auto max-w-[280px]">
                    <div className="font-bold text-muted-foreground uppercase text-[9px] mb-1 no-print">State Coverage Color Key</div>
                    {filteredVendors.map(vendor => {
                      const colorSet = vendorColors[vendor.id];
                      return (
                        <div key={vendor.id} className="flex items-center gap-2 print-legend-item">
                          <div style={{ backgroundColor: colorSet?.base }} className="w-3.5 h-3.5 rounded border border-slate-400" />
                          <span className="font-semibold truncate max-w-[190px]">{vendor.companyName} ({vendor.vendorCode})</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 print-legend-item">
                      <div className="w-3.5 h-3.5 bg-[#e2e8f0] rounded border border-slate-400" />
                      <span className="text-muted-foreground">Unserved District / No Coverage</span>
                    </div>
                  </div>
                )
              )}

              {/* Print-Only Detailed Report Table (Hidden on Web Screen, Flawless on Printout) */}
              {selectedState !== "ALL INDIA" && (
                <div className="hidden print:block mt-8 pt-6 border-t border-slate-200 w-full page-break-before-always text-slate-800 text-left">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-blue-900">{selectedState} District Dispatch Directory</h2>
                      <p className="text-[10px] text-slate-500">Complete breakdown of territorial service dispatch assignments and rates.</p>
                    </div>
                    <div className="text-right text-[10px] text-slate-500">
                      <div>Coverage: {stats.coveragePercent}% ({stats.coveredDistrictsCount}/{stats.totalDistricts})</div>
                      <div>Active Centers: {filteredVendors.length}</div>
                    </div>
                  </div>
                  
                  <table className="w-full text-left border-collapse text-xs border border-slate-200">
                    <thead>
                      <tr className="border-b-2 border-slate-300 bg-slate-50 text-slate-700 font-bold">
                        <th className="py-2 px-3 border border-slate-200">District</th>
                        <th className="py-2 px-3 border border-slate-200">Status</th>
                        <th className="py-2 px-3 border border-slate-200">Assigned Service Center</th>
                        <th className="py-2 px-3 border border-slate-200">Code</th>
                        <th className="py-2 px-3 border border-slate-200">Contact Person</th>
                        <th className="py-2 px-3 border border-slate-200">Contact Number</th>
                        <th className="py-2 px-3 border border-slate-200">Rate LC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {districtCoverage.allDistricts.map((district) => {
                        const nameKey = district.toUpperCase();
                        const covering = districtCoverage.coverage[nameKey] || [];
                        const isCovered = covering.length > 0;
                        
                        if (isCovered) {
                          return covering.map((cov, index) => {
                            const vendor = filteredVendors.find(v => v.id === cov.vendorId);
                            return (
                              <tr key={`${district}-${cov.vendorId}`} className="border-b border-slate-200">
                                {index === 0 && (
                                  <td className="py-2 px-3 font-bold text-slate-900 border border-slate-200 bg-slate-50/50" rowSpan={covering.length}>{district}</td>
                                )}
                                <td className="py-2 px-3 border border-slate-200">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ACTIVE
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-medium border border-slate-200">{cov.vendorName}</td>
                                <td className="py-2 px-3 font-mono font-bold text-blue-700 border border-slate-200">{cov.code}</td>
                                <td className="py-2 px-3 border border-slate-200">{vendor?.ownerName || "N/A"}</td>
                                <td className="py-2 px-3 border border-slate-200">{vendor?.contactNumber || "N/A"}</td>
                                <td className="py-2 px-3 font-bold text-slate-800 border border-slate-200">₹{vendor?.rateLC || "N/A"}</td>
                              </tr>
                            );
                          });
                        } else {
                          return (
                            <tr key={district} className="border-b border-slate-200 bg-slate-50/20 text-slate-400">
                              <td className="py-2 px-3 font-bold text-slate-500 border border-slate-200 bg-slate-50/50">{district}</td>
                              <td className="py-2 px-3 border border-slate-200">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
                                  UNSERVED
                                </span>
                              </td>
                              <td className="py-2 px-3 border border-slate-200 italic" colSpan={5}>
                                No active service center mapped for this district.
                              </td>
                            </tr>
                          );
                        }
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedState === "ALL INDIA" && (
                <div className="hidden print:block mt-8 pt-6 border-t border-slate-200 w-full page-break-before-always text-slate-800 text-left">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-blue-900">National Service Network Directory</h2>
                      <p className="text-[10px] text-slate-500">Comprehensive list of all registered regional service centers across India.</p>
                    </div>
                    <div className="text-right text-[10px] text-slate-500">
                      <div>Total Active Centers: {filteredVendors.length}</div>
                      <div>States Covered: {availableStates.length}</div>
                    </div>
                  </div>
                  
                  <table className="w-full text-left border-collapse text-xs border border-slate-200">
                    <thead>
                      <tr className="border-b-2 border-slate-300 bg-slate-50 text-slate-700 font-bold">
                        <th className="py-2 px-3 border border-slate-200">Code</th>
                        <th className="py-2 px-3 border border-slate-200">Company Name</th>
                        <th className="py-2 px-3 border border-slate-200">Location</th>
                        <th className="py-2 px-3 border border-slate-200">State</th>
                        <th className="py-2 px-3 border border-slate-200">Contact Person</th>
                        <th className="py-2 px-3 border border-slate-200">Contact Number</th>
                        <th className="py-2 px-3 border border-slate-200">Districts Covered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVendors.map((vendor) => (
                        <tr key={vendor.id} className="border-b border-slate-200">
                          <td className="py-2 px-3 font-mono font-bold text-blue-700 border border-slate-200">{vendor.vendorCode}</td>
                          <td className="py-2 px-3 font-bold border border-slate-200">{vendor.companyName}</td>
                          <td className="py-2 px-3 border border-slate-200">{vendor.city || "N/A"}</td>
                          <td className="py-2 px-3 font-semibold text-slate-700 border border-slate-200">{vendor.state || "N/A"}</td>
                          <td className="py-2 px-3 border border-slate-200">{vendor.ownerName || "N/A"}</td>
                          <td className="py-2 px-3 border border-slate-200">{vendor.contactNumber || "N/A"}</td>
                          <td className="py-2 px-3 border border-slate-200 text-[10px] text-slate-600 max-w-[200px] truncate" title={vendor.districtsCovered || "None"}>
                            {vendor.districtsCovered || "None"}
                          </td>
                        </tr>
                      ))}
                      {filteredVendors.length === 0 && (
                        <tr>
                          <td className="py-4 px-3 text-center text-slate-400 italic" colSpan={7}>
                            No service centers currently registered in the database.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Section: Details Panel & Interactive Command Board */}
        <div className="lg:col-span-5 flex flex-col gap-6 no-print">
          
          {/* Quick Statistics Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="shadow-md border-primary/5 bg-white">
              <CardContent className="pt-4 pb-3 flex flex-col items-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">Active Centers</span>
                <span className="text-xl font-black text-primary">{filteredVendors.length}</span>
              </CardContent>
            </Card>
            {selectedState !== "ALL INDIA" ? (
              <Card className="shadow-md border-primary/5 bg-white">
                <CardContent className="pt-4 pb-3 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase mb-0.5">Coverage Ratio</span>
                  <span className="text-xl font-black text-emerald-600">{stats.coveragePercent}%</span>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-md border-primary/5 bg-white">
                <CardContent className="pt-4 pb-3 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase mb-0.5">States Covered</span>
                  <span className="text-xl font-black text-emerald-600">{availableStates.length}</span>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Interactive Legends & Coverage Matrices */}
          <Card className="shadow-lg border-primary/10 flex-1 bg-white/80 backdrop-blur-sm overflow-hidden flex flex-col">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-primary" /> 
                {selectedState === "ALL INDIA" ? "National Overview" : `${selectedState} Operations`}
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedState === "ALL INDIA" 
                  ? "Click on any state on the map to zoom in and show local political district boundaries." 
                  : "View active vendor coverages, inspect districts, or isolate coverage."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 flex-1 flex flex-col gap-6">
              
              {/* List of Registered Service Centers */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                  <span>Service Centers {selectedState !== "ALL INDIA" ? `in ${selectedState}` : "(National)"}</span>
                  {activeVendorFilter && (
                    <button onClick={() => setActiveVendorFilter(null)} className="text-[10px] text-primary underline">
                      Clear Filter
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-1">
                  {filteredVendors.map((vendor) => {
                    const colorSet = vendorColors[vendor.id];
                    const isFiltered = activeVendorFilter === vendor.id;
                    return (
                      <button
                        key={vendor.id}
                        onClick={() => {
                          setActiveVendorFilter(isFiltered ? null : vendor.id);
                          setSelectedDistrict(null);
                        }}
                        style={{ 
                          borderColor: colorSet?.border, 
                          backgroundColor: isFiltered ? colorSet?.base : colorSet?.bg,
                          color: isFiltered ? "#ffffff" : "#1e293b"
                        }}
                        className="flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px] font-bold shadow-sm transition-all hover:scale-105 active:scale-95"
                      >
                        <div 
                          style={{ backgroundColor: isFiltered ? "#ffffff" : colorSet?.base }} 
                          className="w-2 h-2 rounded-full" 
                        />
                        <span className="truncate max-w-[120px]">{vendor.companyName}</span>
                        <Badge variant="outline" className="bg-white/80 text-[8px] scale-90 px-1 py-0.5 border-slate-300">
                          {vendor.vendorCode}
                        </Badge>
                      </button>
                    );
                  })}
                  {filteredVendors.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl w-full flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>No active service centers registered in this state.</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* State Isolation Details */}
              {selectedState !== "ALL INDIA" ? (
                <div className="space-y-4 flex-1 flex flex-col">
                  
                  {/* Selected District Details Card */}
                  {selectedDistrict ? (
                    <div className="bg-blue-50/70 p-4 border border-blue-200/50 rounded-2xl animate-in slide-in-from-top duration-300 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-blue-900 text-sm flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-blue-600 animate-bounce" /> {selectedDistrict} District Details
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDistrict(null)} className="h-6 text-[10px] hover:bg-blue-100 text-blue-700">
                          Clear Selection
                        </Button>
                      </div>
                      
                      {selectedDistrictVendors.length > 0 ? (
                        selectedDistrictVendors.map((vendor) => {
                          const colorSet = vendorColors[vendor.id];
                          return (
                            <div key={vendor.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 space-y-2 animate-in fade-in duration-350">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-800 text-xs">{vendor.companyName}</span>
                                <Badge style={{ backgroundColor: colorSet?.base }} className="text-[9px] font-black text-white">
                                  {vendor.vendorCode}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-sans">
                                <div className="flex items-center gap-1 truncate"><User className="h-3 w-3 text-primary" /> {vendor.ownerName || "N/A"}</div>
                                <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-primary" /> {vendor.contactNumber || "N/A"}</div>
                                <div className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 text-primary" /> {vendor.email || "N/A"}</div>
                                <div className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-primary" /> Rate LC: {vendor.rateLC || "N/A"}</div>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => router.push(`/dashboard/vendors/${vendor.id}`)}
                                className="w-full text-[10px] h-7 border-blue-200 text-blue-700 hover:bg-blue-50"
                              >
                                <Eye className="h-3 w-3 mr-1" /> View Full Profile
                              </Button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 text-slate-400 text-xs py-4 justify-center">
                          <AlertTriangle className="h-4 w-4 text-destructive" /> No active technician coverage in this district.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50/50 p-4 border border-slate-200/50 rounded-2xl text-center py-6 text-xs text-slate-500">
                      <Layers className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                      Click on any district shape on the political map above to inspect covering service centers!
                    </div>
                  )}

                  {/* Complete District Coverage Matrix */}
                  <div className="space-y-2 flex-1 flex flex-col">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                      <span>Territorial Coverage Matrix</span>
                      {(activeVendorFilter || selectedDistrict) && (
                        <button 
                          onClick={() => { setActiveVendorFilter(null); setSelectedDistrict(null); }} 
                          className="text-[10px] text-primary underline"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1 pb-1">
                      {districtCoverage.allDistricts.map(district => {
                        const covering = districtCoverage.coverage[district] || [];
                        const isCovered = covering.length > 0;
                        const isSelected = selectedDistrict === district;
                        const isIsolatedByFilter = activeVendorFilter 
                          ? covering.some(cv => cv.vendorId === activeVendorFilter)
                          : null;
                        
                        let style: React.CSSProperties = {};
                        let borderClass = "border-dashed bg-slate-50 border-slate-300 text-slate-400";
                        
                        if (isCovered) {
                          const colorSet = vendorColors[covering[0].vendorId];
                          
                          if (activeVendorFilter) {
                            if (isIsolatedByFilter) {
                              style = { borderColor: colorSet?.base, backgroundColor: colorSet?.bg, color: "#0f172a" };
                              borderClass = "border-solid shadow-sm";
                            } else {
                              style = { borderColor: "#f1f5f9", backgroundColor: "#f8fafc", color: "#cbd5e1" };
                              borderClass = "border-solid opacity-30";
                            }
                          } else {
                            style = { borderColor: colorSet?.border, backgroundColor: colorSet?.bg, color: "#1e293b" };
                            borderClass = "border-solid";
                          }
                        }

                        if (isSelected) {
                          style = { ...style, boxShadow: "0 0 0 2px #2563eb", borderColor: "#2563eb" };
                        }

                        return (
                          <div
                            key={district}
                            style={style}
                            onClick={() => setSelectedDistrict(isSelected ? null : district)}
                            className={`p-2 rounded-xl border text-[10px] cursor-pointer hover:border-primary/50 transition-all duration-300 flex justify-between items-center ${borderClass}`}
                          >
                            <span className="font-bold truncate max-w-[110px]">{district}</span>
                            {isCovered ? (
                              <div className="flex items-center gap-1">
                                {covering.map((c, i) => (
                                  <span key={i} style={{ backgroundColor: c.color }} className="w-2 h-2 rounded-full animate-pulse" />
                                ))}
                              </div>
                            ) : (
                              <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              ) : (
                // State: ALL INDIA view - Show list of covered states with stats
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Regional Distribution Summary
                  </div>
                  
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 flex-1">
                    {availableStates.map(state => {
                      const count = stateVendorCounts[state] || 0;
                      return (
                        <div 
                          key={state}
                          onClick={() => { setSelectedState(state); setActiveVendorFilter(null); setSelectedDistrict(null); }}
                          className="flex justify-between items-center p-3 rounded-xl border bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all border-slate-200 group"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-primary group-hover:scale-125 transition-transform" />
                            <span className="font-extrabold text-slate-800 text-xs">{state}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] font-black">
                              {count} Service Center{count > 1 ? 's' : ''}
                            </Badge>
                            <span className="text-[9px] text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                              Zoom In &rarr;
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {availableStates.length === 0 && (
                      <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl bg-slate-50">
                        No operations registered across India yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
