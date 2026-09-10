import React from 'react';

export const MiningAnimation: React.FC = () => {
  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-subtle flex flex-col">

      {/* SVG Canvas Area */}
      <div className="relative w-full h-80 bg-gradient-to-b from-slate-100/60 via-slate-50/40 to-slate-200/50 overflow-hidden select-none">
        {/* Subtle grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_2rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

        <svg viewBox="0 0 1000 320" className="w-full h-full preserve-3d" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="strata1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="strata2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            <linearGradient id="strataOre" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1E3A2F" />
              <stop offset="100%" stopColor="#11241D" />
            </linearGradient>
            <linearGradient id="truckBody" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#CA8A04" />
            </linearGradient>
          </defs>

          {/* BACKGROUND: Terraced Open Pit Benches */}
          {/* Top bench */}
          <path d="M 0 110 L 220 110 L 250 145 L 620 145 L 660 185 L 1000 185 L 1000 320 L 0 320 Z" fill="#E2E8F0" opacity="0.7" />

          {/* Middle bench */}
          <path d="M 0 150 L 320 150 L 360 195 L 750 195 L 790 235 L 1000 235 L 1000 320 L 0 320 Z" fill="url(#strata2)" opacity="0.35" />

          {/* Manganese Ore Bed Outcrop (Dark Forest Grey-Green) */}
          <path d="M 0 195 L 160 195 L 200 240 L 520 240 L 570 280 L 1000 280 L 1000 320 L 0 320 Z" fill="url(#strataOre)" opacity="0.9" />

          {/* Quarry Base Level */}
          <rect x="0" y="278" width="1000" height="42" fill="#1E293B" />
          <line x1="0" y1="278" x2="1000" y2="278" stroke="#183D2B" strokeWidth="3" />

          {/* HAUL ROAD BENCH - Center level */}
          <line x1="180" y1="195" x2="760" y2="195" stroke="#94A3B8" strokeWidth="2" strokeDasharray="6 4" opacity="0.6" />

          {/* CONVEYOR BELT TRUSS - Mid background */}
          <g transform="translate(680, 110)">
            <line x1="0" y1="85" x2="280" y2="15" stroke="#64748B" strokeWidth="4" />
            <line x1="0" y1="89" x2="280" y2="19" stroke="#334155" strokeWidth="2" />
            {/* Conveyor supports */}
            <line x1="60" y1="70" x2="60" y2="125" stroke="#475569" strokeWidth="2" />
            <line x1="140" y1="50" x2="140" y2="125" stroke="#475569" strokeWidth="2" />
            <line x1="220" y1="30" x2="220" y2="125" stroke="#475569" strokeWidth="2" />
            {/* Animated rocks on conveyor */}
            <circle cx="40" cy="74" r="3" fill="#183D2B">
              <animate attributeName="cx" from="10" to="270" dur="4s" repeatCount="indefinite" />
              <animate attributeName="cy" from="83" to="17" dur="4s" repeatCount="indefinite" />
            </circle>
            <circle cx="120" cy="55" r="3.5" fill="#334155">
              <animate attributeName="cx" from="10" to="270" dur="4s" begin="1.3s" repeatCount="indefinite" />
              <animate attributeName="cy" from="83" to="17" dur="4s" begin="1.3s" repeatCount="indefinite" />
            </circle>
            <circle cx="180" cy="40" r="4" fill="#0F261B">
              <animate attributeName="cx" from="10" to="270" dur="4s" begin="2.6s" repeatCount="indefinite" />
              <animate attributeName="cy" from="83" to="17" dur="4s" begin="2.6s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* CRANE / HEAVY EXCAVATOR (Left side, Bench 2) */}
          <g transform="translate(130, 195)">
            {/* Crawler tracks */}
            <rect x="-35" y="-12" width="70" height="12" rx="4" fill="#0F172A" />
            <circle cx="-25" cy="-6" r="4" fill="#64748B" />
            <circle cx="-12" cy="-6" r="4" fill="#64748B" />
            <circle cx="0" cy="-6" r="4" fill="#64748B" />
            <circle cx="12" cy="-6" r="4" fill="#64748B" />
            <circle cx="25" cy="-6" r="4" fill="#64748B" />

            {/* Rotating Upper Cab */}
            <rect x="-24" y="-36" width="46" height="24" rx="3" fill="#183D2B" />
            <rect x="-18" y="-32" width="16" height="12" rx="2" fill="#E2E8F0" opacity="0.8" />

            {/* Pivoting Crane Boom & Cable */}
            <g style={{ transformOrigin: '-5px -30px', animation: 'cranePivot 9s ease-in-out infinite' }}>
              {/* Boom Arm */}
              <line x1="-5" y1="-30" x2="75" y2="-90" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
              <line x1="-5" y1="-30" x2="75" y2="-90" stroke="#B45309" strokeWidth="2" strokeDasharray="5 5" />
              <circle cx="75" cy="-90" r="4" fill="#334155" />

              {/* Cable with suspended debris basket */}
              <g style={{ animation: 'cableLift 9s ease-in-out infinite' }}>
                <line x1="75" y1="-90" x2="75" y2="-45" stroke="#334155" strokeWidth="2" />
                {/* Bucket / Clamshell */}
                <path d="M 66 -45 L 84 -45 L 80 -32 L 70 -32 Z" fill="#1E293B" />
                {/* Ore rock debris */}
                <polygon points="72,-42 78,-44 81,-39 75,-36" fill="#183D2B" />
                <polygon points="68,-40 73,-43 74,-38" fill="#4EBA87" />
              </g>
            </g>
          </g>

          {/* DUMP TRUCK 1 (CAT 777) - Moving along Haul Road */}
          <g>
            {/* Animating truck moving across bench */}
            <g style={{ animation: 'truckDrive 14s ease-in-out infinite' }}>
              <g transform="translate(390, 195)">
                {/* Truck Chassis */}
                <rect x="-36" y="-18" width="72" height="10" fill="#334155" rx="2" />
                {/* Dump Bed */}
                <path d="M -35 -38 L 14 -38 L 10 -18 L -35 -18 Z" fill="url(#truckBody)" />
                {/* Mined Ore Pile in Dump Bed */}
                <path d="M -30 -38 Q -10 -48 10 -38 Z" fill="#183D2B" />
                {/* Cab */}
                <path d="M 12 -34 L 32 -34 L 35 -18 L 12 -18 Z" fill="#F59E0B" />
                <rect x="20" y="-30" width="10" height="8" rx="1" fill="#E2E8F0" />
                {/* Heavy Rubber Wheels */}
                <circle cx="-22" cy="-8" r="9" fill="#0F172A" />
                <circle cx="-22" cy="-8" r="4" fill="#64748B" />
                <circle cx="22" cy="-8" r="9" fill="#0F172A" />
                <circle cx="22" cy="-8" r="4" fill="#64748B" />

                {/* Subtle Dust particles behind wheels */}
                <circle cx="-38" cy="-5" r="2.5" fill="#CBD5E1" opacity="0.6">
                  <animate attributeName="r" values="2;6;0" dur="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0" dur="1s" repeatCount="indefinite" />
                  <animate attributeName="cx" values="-38;-50" dur="1s" repeatCount="indefinite" />
                </circle>
              </g>
            </g>
          </g>

          {/* MINERS / FIELD ENGINEERS (Right bench 3) */}
          <g transform="translate(680, 235)">
            {/* Miner 1 with hardhat inspecting strata */}
            <circle cx="-20" cy="-22" r="3.5" fill="#F59E0B" /> {/* Yellow hardhat */}
            <circle cx="-20" cy="-17" r="2.5" fill="#FED7AA" /> {/* Head */}
            <line x1="-20" y1="-14" x2="-20" y2="-4" stroke="#183D2B" strokeWidth="4" /> {/* Body */}
            <line x1="-20" y1="-4" x2="-24" y2="0" stroke="#334155" strokeWidth="2.5" /> {/* Legs */}
            <line x1="-20" y1="-4" x2="-17" y2="0" stroke="#334155" strokeWidth="2.5" />
            <line x1="-20" y1="-12" x2="-13" y2="-17" stroke="#183D2B" strokeWidth="2" /> {/* Arm holding tablet/measurer */}
            <rect x="-14" y="-19" width="4" height="6" fill="#38A169" rx="1" />

            {/* Miner 2 operating core sampler drill */}
            <g transform="translate(25, 0)">
              <circle cx="0" cy="-22" r="3.5" fill="#EF4444" /> {/* Red hardhat */}
              <circle cx="0" cy="-17" r="2.5" fill="#FED7AA" />
              <line x1="0" y1="-14" x2="0" y2="-4" stroke="#475569" strokeWidth="4" />
              <line x1="0" y1="-4" x2="-4" y2="0" stroke="#1E293B" strokeWidth="2.5" />
              <line x1="0" y1="-4" x2="4" y2="0" stroke="#1E293B" strokeWidth="2.5" />
              {/* Tripod drill frame */}
              <line x1="8" y1="-26" x2="16" y2="0" stroke="#94A3B8" strokeWidth="2" />
              <line x1="8" y1="-26" x2="4" y2="0" stroke="#94A3B8" strokeWidth="2" />
              <line x1="8" y1="-26" x2="8" y2="2" stroke="#38A169" strokeWidth="2.5" />
              {/* Miner arm on drill */}
              <line x1="0" y1="-11" x2="8" y2="-15" stroke="#475569" strokeWidth="2" />
            </g>
          </g>

          {/* DUMP TRUCK 2 (Pit Bottom Floor) - Returning empty */}
          <g transform="translate(850, 278)">
            <rect x="-28" y="-14" width="56" height="8" fill="#334155" rx="1.5" />
            <path d="M -26 -28 L 8 -28 L 5 -14 L -26 -14 Z" fill="#CA8A04" />
            <path d="M 8 -24 L 24 -24 L 26 -14 L 8 -14 Z" fill="#F59E0B" />
            <circle cx="-16" cy="-6" r="7" fill="#0F172A" />
            <circle cx="16" cy="-6" r="7" fill="#0F172A" />
          </g>

          {/* Bench Marker Flags */}
          <g transform="translate(50, 110)">
            <line x1="0" y1="0" x2="0" y2="-18" stroke="#64748B" strokeWidth="1.5" />
            <polygon points="0,-18 12,-14 0,-10" fill="#38A169" />
          </g>
          <g transform="translate(940, 185)">
            <line x1="0" y1="0" x2="0" y2="-18" stroke="#64748B" strokeWidth="1.5" />
            <polygon points="0,-18 -12,-14 0,-10" fill="#EAB308" />
          </g>
        </svg>

      </div>
    </div>
  );
};
