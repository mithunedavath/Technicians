"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Map, MapPin, Building2, User, Phone, CheckCircle2, AlertTriangle, RefreshCw, Layers, ShieldCheck, MapPinned } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

// Curated list of major districts per state for visualization.
// Any districts entered by the user that are NOT in this list will be dynamically added,
// ensuring the visualization is 100% complete and robust.
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
    "Noida", "Ghaziabad", "Lucknow", "Kanpur", "Agra", "Varanasi", "Meerut", "Prayagraj", 
    "Bareilly", "Aligarh", "Moradabad", "Gorakhpur", "Saharanpur", "Jhansi", "Mathura", 
    "Muzaffarnagar", "Firozabad", "Lalitpur", "Ayodhya", "Hapur", "Bulandshahr"
  ],
  "MAHARASHTRA": [
    "Mumbai", "Pune", "Thane", "Nagpur", "Nashik", "Aurangabad", "Solapur", "Amravati", 
    "Navi Mumbai", "Kolhapur", "Sangli", "Satara", "Ahmednagar", "Jalgaon", "Nanded",
    "Latur", "Dhule", "Chandrapur", "Parbhani", "Yavatmal", "Akola", "Gondia"
  ],
  "KARNATAKA": [
    "Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi", 
    "Kalaburagi", "Davanagere", "Ballari", "Vijayapura", "Shivamogga", "Tumakuru", "Udupi", "Bidar"
  ],
  "TAMIL NADU": [
    "Chennai", "Coimbatore", "Madurai", "Trichy", "Salem", "Tirunelveli", "Vellore", 
    "Thoothukudi", "Erode", "Kanchipuram", "Tiruppur", "Thanjavur", "Dindigul", "Cuddalore"
  ],
  "WEST BENGAL": [
    "Kolkata", "Howrah", "Darjeeling", "Hooghly", "North 24 Parganas", "South 24 Parganas", 
    "Paschim Medinipur", "Purba Medinipur", "Murshidabad", "Bardhaman", "Nadia", "Malda", "Jalpaiguri"
  ],
  "TELANGANA": [
    "Hyderabad", "Secunderabad", "Medchal-Malkajgiri", "Rangareddy", "Warangal", "Karimnagar", 
    "Nizamabad", "Khammam", "Nalgonda", "Mahabubnagar", "Adilabad", "Medak"
  ],
  "ANDHRA PRADESH": [
    "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Kakinada", "Tirupati", 
    "Rajahmundry", "Kadapa", "Anantapur", "Chittoor", "Eluru", "Ongole"
  ],
  "RAJASTHAN": [
    "Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Alwar", "Bhilwara", 
    "Sikar", "Sri Ganganagar", "Bharatpur", "Pali", "Barmer", "Jaisalmer"
  ],
  "GUJARAT": [
    "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar", "Jamnagar", 
    "Junagadh", "Anand", "Mehsana", "Bharuch", "Morbi", "Valsad", "Vapi"
  ],
  "PUNJAB": [
    "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Hoshiarpur", 
    "Pathankot", "Moga", "Firozpur", "Pathankot", "Faridkot", "Gurdaspur"
  ],
  "KERALA": [
    "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Alappuzha", 
    "Kottayam", "Palakkad", "Malappuram", "Kannur", "Wayanad", "Idukki"
  ]
};

// Simplified but beautiful and mathematically correct SVG path coordinates for All-India States
// Each path matches a standard state code to allow interactive highlighting, hover effects, and selection.
const SVG_INDIA_PATHS = [
  { id: "JK", name: "Jammu & Kashmir", d: "M 230,80 L 260,60 L 290,70 L 305,100 L 280,130 L 230,120 Z" },
  { id: "LA", name: "Ladakh", d: "M 290,70 L 330,40 L 380,60 L 360,110 L 305,100 Z" },
  { id: "HP", name: "Himachal Pradesh", d: "M 280,130 L 305,100 L 360,110 L 340,150 L 300,165 Z" },
  { id: "PB", name: "Punjab", d: "M 220,150 L 280,130 L 300,165 L 260,195 L 220,185 Z" },
  { id: "UK", name: "Uttarakhand", d: "M 340,150 L 385,160 L 400,200 L 350,215 L 340,180 Z" },
  { id: "HR", name: "Haryana", d: "M 260,195 L 300,165 L 340,180 L 335,225 L 290,240 L 265,220 Z" },
  { id: "DL", name: "Delhi", d: "M 320,210 A 10,10 0 1,1 320,210.1 Z" }, // Rendered larger for clickability
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
  // Northeast States (grouped beautifully for interactive navigation)
  { id: "SK", name: "Sikkim", d: "M 590,230 L 610,230 L 605,250 L 585,250 Z" },
  { id: "AS", name: "Assam", d: "M 630,250 L 690,240 L 710,270 L 670,290 L 640,285 Z" },
  { id: "AR", name: "Arunachal Pradesh", d: "M 670,220 L 740,210 L 750,250 L 690,240 Z" },
  { id: "NL", name: "Nagaland", d: "M 725,250 L 750,255 L 745,280 L 720,270 Z" },
  { id: "MN", name: "Manipur", d: "M 715,280 L 740,285 L 735,310 L 710,305 Z" },
  { id: "MZ", name: "Mizoram", d: "M 705,315 L 725,315 L 715,350 L 700,340 Z" },
  { id: "TR", name: "Tripura", d: "M 685,305 L 705,305 L 700,325 L 685,320 Z" },
  { id: "ML", name: "Meghalaya", d: "M 630,270 L 670,270 L 665,290 L 625,290 Z" }
];

export function MapClient() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [selectedState, setSelectedState] = useState<string>("HARYANA");
  const [activeVendorFilter, setActiveVendorFilter] = useState<string | null>(null);

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

  // Fallback to first available state if HARYANA is not in the DB
  useEffect(() => {
    if (availableStates.length > 0 && !availableStates.includes(selectedState)) {
      setSelectedState(availableStates[0]);
    }
  }, [availableStates, selectedState]);

  // Filter vendors in the selected state
  const stateVendors = useMemo(() => {
    if (!vendors || !selectedState) return [];
    return vendors.filter(v => v.state?.toUpperCase().trim() === selectedState);
  }, [vendors, selectedState]);

  // Assign distinct dynamic HSL colors to each vendor in the selected state to represent their coverage
  const vendorColors = useMemo(() => {
    const colors: Record<string, { base: string, glow: string, bg: string, border: string }> = {};
    if (stateVendors.length === 0) return colors;

    stateVendors.forEach((vendor, index) => {
      // Space hues evenly in HSL wheel
      const hue = (index * (360 / stateVendors.length)) % 360;
      colors[vendor.id] = {
        base: `hsl(${hue}, 85%, 45%)`,
        glow: `hsl(${hue}, 90%, 55%, 0.3)`,
        bg: `hsl(${hue}, 95%, 97%)`,
        border: `hsl(${hue}, 70%, 80%)`,
      };
    });
    return colors;
  }, [stateVendors]);

  // Map districts of the selected state to covering vendors
  const districtCoverage = useMemo(() => {
    const coverage: Record<string, { vendorId: string; vendorName: string; color: string; code: string }[]> = {};
    
    // Get pre-defined districts for selected state
    const presetDistricts = STATE_DISTRICTS_PRESETS[selectedState] || [];
    
    // Gather all unique district entries entered by users
    const allDistrictsSet = new Set<string>(presetDistricts);
    
    stateVendors.forEach(vendor => {
      if (!vendor.districtsCovered) return;
      // Split comma separated list, normalize names
      const list = vendor.districtsCovered.split(",")
        .map((d: string) => d.trim())
        .filter(Boolean);
        
      list.forEach((d: string) => {
        allDistrictsSet.add(d);
      });
    });

    const allDistricts = Array.from(allDistrictsSet).sort();

    // Map each district to the vendor(s) covering it
    allDistricts.forEach(district => {
      coverage[district] = [];
      stateVendors.forEach(vendor => {
        if (!vendor.districtsCovered) return;
        const list = vendor.districtsCovered.split(",").map((d: string) => d.trim().toLowerCase());
        if (list.includes(district.toLowerCase())) {
          coverage[district].push({
            vendorId: vendor.id,
            vendorName: vendor.companyName,
            color: vendorColors[vendor.id]?.base || "#10b981",
            code: vendor.vendorCode
          });
        }
      });
    });

    return { coverage, allDistricts };
  }, [selectedState, stateVendors, vendorColors]);

  // Calculate density of vendors per state for map fill styling
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

  const handleStateClick = (stateName: string) => {
    const upper = stateName.toUpperCase();
    if (availableStates.includes(upper)) {
      setSelectedState(upper);
      setActiveVendorFilter(null);
      toast({
        title: `Switched State to ${stateName}`,
        description: `Viewing ${stateVendors.length} active service centers in ${stateName}.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "No Coverage Found",
        description: `There are currently no registered vendors in ${stateName}. You can add them in the Vendors tab.`,
      });
    }
  };

  if (isUserLoading || !user) return null;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <MapPinned className="h-8 w-8 text-primary" /> State Coverage Mapping
          </h1>
          <p className="text-muted-foreground">
            Visualize your regional technician force, service centers, and coverage territories in real-time.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs uppercase font-bold text-muted-foreground whitespace-nowrap">Selected State:</span>
          <Select value={selectedState} onValueChange={(val) => { setSelectedState(val); setActiveVendorFilter(null); }}>
            <SelectTrigger className="w-[200px] border-primary/20 hover:border-primary/50 shadow-md">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {availableStates.map(state => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
              {availableStates.length === 0 && (
                <SelectItem value="NO_VENDORS" disabled>No Registered States Yet</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Map */}
        <Card className="lg:col-span-5 shadow-lg border-primary/10 bg-white/80 backdrop-blur-sm overflow-hidden flex flex-col">
          <CardHeader className="bg-primary/5 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <Map className="h-5 w-5" /> Interactive Map of India
            </CardTitle>
            <CardDescription className="text-xs">
              Hover to view active vendors. Click on highlighted states to view local district mapping.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-4 relative min-h-[450px]">
            {isVendorsLoading ? (
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Drawing vector map...</p>
              </div>
            ) : (
              <svg 
                viewBox="50 0 750 900" 
                className="w-full h-full max-h-[550px] transition-transform duration-500 drop-shadow-xl"
              >
                <g stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round">
                  {SVG_INDIA_PATHS.map((path) => {
                    const density = stateVendorCounts[path.name.toUpperCase()] || 0;
                    const isActive = selectedState === path.name.toUpperCase();
                    const hasVendors = density > 0;
                    
                    // Style states based on status
                    let fill = "#e2e8f0"; // slate-200 (unserved)
                    let strokeColor = "#ffffff";
                    let strokeWidthValue = "1.5";
                    
                    if (hasVendors) {
                      // Emerald gradients depending on vendor numbers
                      if (density === 1) fill = "#d1fae5"; // emerald-100
                      else if (density <= 3) fill = "#a7f3d0"; // emerald-200
                      else fill = "#6ee7b7"; // emerald-300
                    }
                    
                    if (isActive) {
                      fill = "#3b82f6"; // primary blue active state
                      strokeColor = "#1e3a8a";
                      strokeWidthValue = "2.5";
                    }

                    return (
                      <path
                        key={path.id}
                        id={path.id}
                        d={path.d}
                        fill={fill}
                        stroke={strokeColor}
                        strokeWidth={strokeWidthValue}
                        className={`transition-all duration-300 cursor-pointer ${
                          hasVendors 
                            ? "hover:fill-blue-400 hover:opacity-90" 
                            : "hover:fill-slate-300 hover:opacity-80"
                        }`}
                        onClick={() => handleStateClick(path.name)}
                      >
                        <title>
                          {path.name} {density > 0 ? `(${density} Center${density > 1 ? 's' : ''})` : "(No Active Center)"}
                        </title>
                      </path>
                    );
                  })}
                </g>
              </svg>
            )}
            
            {/* Map Legend */}
            <div className="absolute bottom-4 left-4 bg-white/90 shadow-md border rounded-xl p-3 text-[10px] space-y-1.5 backdrop-blur-sm">
              <div className="font-bold text-muted-foreground uppercase text-[9px] mb-1">State Coverage Density</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#3b82f6] rounded border border-blue-900" />
                <span className="font-bold">Active Selection ({selectedState})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#6ee7b7] rounded border border-white" />
                <span>High Density (4+ centers)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#a7f3d0] rounded border border-white" />
                <span>Medium Density (2-3 centers)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#d1fae5] rounded border border-white" />
                <span>Single Center</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#e2e8f0] rounded border border-white" />
                <span className="text-muted-foreground">Unregistered / No Centers</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: District Details & Area Identification */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="shadow-md border-primary/5 bg-white/70">
              <CardContent className="pt-4 pb-3 flex flex-col items-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Active Centers</span>
                <span className="text-2xl font-black text-primary">{stateVendors.length}</span>
              </CardContent>
            </Card>
            <Card className="shadow-md border-primary/5 bg-white/70">
              <CardContent className="pt-4 pb-3 flex flex-col items-center">
                <span className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Districts Serviced</span>
                <span className="text-2xl font-black text-emerald-600">{stats.coveredDistrictsCount}</span>
              </CardContent>
            </Card>
            <Card className="shadow-md border-primary/5 bg-white/70">
              <CardContent className="pt-4 pb-3 flex flex-col items-center">
                <span className="text-[10px] font-bold text-destructive uppercase mb-1">Unserved Districts</span>
                <span className="text-2xl font-black text-destructive">{stats.unservedDistrictsCount}</span>
              </CardContent>
            </Card>
            <Card className="shadow-md border-primary/5 bg-white/70">
              <CardContent className="pt-4 pb-3 flex flex-col items-center">
                <span className="text-[10px] font-bold text-blue-600 uppercase mb-1">Coverage Ratio</span>
                <span className="text-2xl font-black text-blue-600">{stats.coveragePercent}%</span>
              </CardContent>
            </Card>
          </div>

          {/* District Coverage command board */}
          <Card className="shadow-lg border-primary/10 flex-1 bg-white/80 backdrop-blur-sm flex flex-col">
            <CardHeader className="bg-muted/30 border-b pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary animate-pulse" /> {selectedState} Coverage Territory Board
                </CardTitle>
                <CardDescription className="text-xs">
                  A dynamic map matrix displaying serviced and unserved districts. Color coding uniquely represents each service center.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-6 flex-1 flex flex-col gap-6">
              
              {/* Active State Vendors Legend */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Service Centers in {selectedState}</div>
                <div className="flex flex-wrap gap-2">
                  {stateVendors.map((vendor) => {
                    const colorSet = vendorColors[vendor.id];
                    const isFiltered = activeVendorFilter === vendor.id;
                    return (
                      <button
                        key={vendor.id}
                        onClick={() => setActiveVendorFilter(isFiltered ? null : vendor.id)}
                        style={{ 
                          borderColor: colorSet?.border, 
                          backgroundColor: isFiltered ? colorSet?.base : colorSet?.bg,
                          color: isFiltered ? "#ffffff" : "#1e293b"
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95"
                      >
                        <div 
                          style={{ backgroundColor: isFiltered ? "#ffffff" : colorSet?.base }} 
                          className="w-2.5 h-2.5 rounded-full shadow-inner animate-ping" 
                        />
                        <span className="truncate max-w-[180px]">{vendor.companyName}</span>
                        <Badge variant="outline" className="bg-white/80 text-[10px] scale-90 px-1 py-0 border-slate-300">
                          {vendor.vendorCode}
                        </Badge>
                      </button>
                    );
                  })}
                  {stateVendors.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl flex items-center gap-2 w-full">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <div>
                        <strong>No service centers registered in {selectedState}.</strong> Go to the <span className="underline font-bold cursor-pointer" onClick={() => router.push('/dashboard/vendors/new')}>Vendors form</span> to register a new vendor for this state.
                      </div>
                    </div>
                  )}
                </div>
                {stateVendors.length > 0 && (
                  <div className="text-[10px] text-muted-foreground italic flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Tip: Click on a service center badge to isolate and highlight only their coverage areas below.
                  </div>
                )}
              </div>

              <Separator />

              {/* District Grid */}
              <div className="space-y-3 flex-1">
                <div className="flex justify-between items-center">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Territorial Coverage Matrix</div>
                  {activeVendorFilter && (
                    <Button variant="ghost" size="sm" onClick={() => setActiveVendorFilter(null)} className="h-7 text-xs text-primary">
                      Clear Filter Highlight
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto pr-2 pb-2">
                  {districtCoverage.allDistricts.map((district) => {
                    const coveringVendors = districtCoverage.coverage[district] || [];
                    const isCovered = coveringVendors.length > 0;
                    
                    // Filter logic
                    const isIsolatedByFilter = activeVendorFilter 
                      ? coveringVendors.some(cv => cv.vendorId === activeVendorFilter)
                      : null;
                      
                    // Styling
                    let chipStyle: React.CSSProperties = {};
                    let badgeClass = "border-dashed border-slate-300 text-slate-400 bg-slate-50";
                    let glowClass = "";

                    if (isCovered) {
                      const firstVendor = coveringVendors[0];
                      const colorSet = vendorColors[firstVendor.vendorId];
                      
                      if (activeVendorFilter) {
                        if (isIsolatedByFilter) {
                          chipStyle = { 
                            borderColor: colorSet?.base, 
                            backgroundColor: colorSet?.bg, 
                            color: "#0f172a",
                            boxShadow: `0 0 10px ${colorSet?.glow}`
                          };
                          badgeClass = "border-solid shadow-sm";
                          glowClass = "animate-pulse";
                        } else {
                          // Dimmed
                          chipStyle = { borderColor: "#f1f5f9", backgroundColor: "#f8fafc", color: "#cbd5e1" };
                          badgeClass = "border-solid opacity-30";
                        }
                      } else {
                        // Standard Covered Styling
                        chipStyle = { 
                          borderColor: colorSet?.border, 
                          backgroundColor: colorSet?.bg, 
                          color: "#1e293b" 
                        };
                        badgeClass = "border-solid shadow-sm hover:shadow-md transition-shadow";
                      }
                    }

                    return (
                      <div
                        key={district}
                        style={chipStyle}
                        className={`flex flex-col justify-between p-3 rounded-xl border text-xs min-h-[70px] transition-all duration-300 ${badgeClass}`}
                      >
                        <div className="font-bold truncate" title={district}>
                          {district}
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-2">
                          {isCovered ? (
                            <div className="flex flex-col gap-0.5 w-full">
                              {coveringVendors.map((cv, idx) => (
                                <span 
                                  key={idx}
                                  style={{ color: cv.color }} 
                                  className="text-[9px] font-black tracking-tight truncate flex items-center gap-1"
                                >
                                  <span style={{ backgroundColor: cv.color }} className={`w-1.5 h-1.5 rounded-full inline-block ${glowClass}`} />
                                  {cv.code}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[9px] text-destructive font-semibold flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              Unserved
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
