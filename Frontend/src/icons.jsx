const base = {
  width: 20, height: 20, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true,
};
export const Mail = (p) => (<svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>);
export const Lock = (p) => (<svg {...base} {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>);
export const Eye = (p) => (<svg {...base} {...p}><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>);
export const EyeOff = (p) => (<svg {...base} {...p}><path d="M3 3l18 18"/><path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17 17 0 0 1-3.2 4M6.5 7.2A17 17 0 0 0 2 12s3.5 6.5 10 6.5c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>);
export const Arrow = (p) => (<svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
export const Box = (p) => (<svg {...base} {...p}><path d="M12 3 4 7.2v9.6L12 21l8-4.2V7.2L12 3Z"/><path d="m4 7.2 8 4.3 8-4.3M12 11.5V21"/></svg>);
export const Receipt = (p) => (<svg {...base} {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg>);
export const Chart = (p) => (<svg {...base} {...p}><path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/></svg>);
export const Chat = (p) => (<svg {...base} {...p}><path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z"/><path d="M9 11h6M9 14h4"/></svg>);
export const Alert = (p) => (<svg {...base} {...p}><path d="M12 4 2.8 19h18.4L12 4Z"/><path d="M12 10v4M12 17v.01"/></svg>);
export const Check = (p) => (<svg {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>);
export const User = (p) => (<svg {...base} {...p}><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>);
