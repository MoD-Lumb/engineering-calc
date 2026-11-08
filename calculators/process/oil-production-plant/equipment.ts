// Content for the 3D oil production plant explainer.
// Numbering follows the process flow, so the guided tour simply walks the list in order.

export type StreamKey = 'well' | 'oil' | 'gas' | 'water' | 'glycol' | 'flare';

export type SystemKey = 'wells' | 'oil' | 'gas' | 'water' | 'utilities';

export type EquipmentId =
  | 'reservoir'
  | 'wells'
  | 'manifold'
  | 'test-separator'
  | 'inlet-heater'
  | 'hp-separator'
  | 'lp-separator'
  | 'treater'
  | 'stabilizer'
  | 'storage'
  | 'export'
  | 'scrubber'
  | 'compressor'
  | 'dehydration'
  | 'gas-export'
  | 'flare'
  | 'hydrocyclone'
  | 'flotation'
  | 'injection'
  | 'control-room';

export interface StreamInfo {
  label: string;
  color: string;
}

export const STREAMS: Record<StreamKey, StreamInfo> = {
  well: { label: 'Well fluid (oil + gas + water)', color: '#e2843c' },
  oil: { label: 'Crude oil', color: '#8f4f16' },
  gas: { label: 'Gas', color: '#e6b416' },
  water: { label: 'Produced water', color: '#3b82f6' },
  glycol: { label: 'Glycol (TEG)', color: '#a855f7' },
  flare: { label: 'Relief / flare', color: '#ef4444' },
};

export const STREAM_ORDER: StreamKey[] = ['well', 'oil', 'gas', 'water', 'glycol', 'flare'];

export interface SystemInfo {
  label: string;
  color: string;
}

export const SYSTEMS: Record<SystemKey, SystemInfo> = {
  wells: { label: 'Reservoir, wells & inlet', color: '#d9772f' },
  oil: { label: 'Oil train', color: '#8f4f16' },
  gas: { label: 'Gas train', color: '#b98a00' },
  water: { label: 'Water train', color: '#2563eb' },
  utilities: { label: 'Safety & control', color: '#64748b' },
};

export const SYSTEM_ORDER: SystemKey[] = ['wells', 'oil', 'gas', 'water', 'utilities'];

export interface EquipmentInfo {
  id: EquipmentId;
  n: number;
  name: string;
  /** Short name used for the 3D label. */
  short: string;
  system: SystemKey;
  summary: string;
  how: string[];
  /** What to look at in the 3D model. */
  look?: string;
  typical: Array<[string, string]>;
}

export const EQUIPMENT: EquipmentInfo[] = [
  {
    id: 'reservoir',
    n: 1,
    name: 'Reservoir',
    short: 'Reservoir',
    system: 'wells',
    summary:
      'Oil, gas and water are held in the pore space of a porous, permeable rock (sandstone or carbonate) sealed by an impermeable cap rock. The fluids sit in layers by density: free gas in a gas cap on top, oil below it, and water (the aquifer) at the bottom.',
    how: [
      'Fluids flow through the rock to the well because the wellbore is held at a lower pressure than the reservoir. This pressure difference is called the drawdown.',
      'The natural drive comes from expansion of dissolved gas, of the gas cap and of the aquifer. Later in field life, water injection keeps the pressure up.',
      'As the oil rises up the well its pressure falls and dissolved gas comes out of solution. The well stream therefore reaches the surface as a mixture of oil, gas and water.',
    ],
    look: 'Underground view: gas cap (yellow), oil zone (brown) and aquifer (blue). The production wells end in the oil zone; the injection well ends in the aquifer. The vertical scale is heavily compressed.',
    typical: [
      ['Depth', '1 000 – 4 000 m'],
      ['Pressure', '100 – 400 bar'],
      ['Temperature', '50 – 120 °C'],
      ['Porosity', '10 – 30 %'],
    ],
  },
  {
    id: 'wells',
    n: 2,
    name: 'Production wells & Christmas trees',
    short: 'Wells',
    system: 'wells',
    summary:
      'Each well is a steel-cased hole drilled into the reservoir, with production tubing inside. The "Christmas tree" on the wellhead is a stack of valves that contains the well pressure and controls the flow.',
    how: [
      'Perforations through the casing let reservoir fluid in. It then flows up the tubing (animated underground).',
      'Master valves shut the well in. The wing valve sends flow to the flowline. The swab valve on top gives vertical access for wireline tools.',
      'The choke sets the production rate by taking a controlled pressure drop.',
      'When reservoir pressure is too low to lift the fluid, artificial lift is used: gas lift, electric submersible pumps (ESP) or rod pumps.',
    ],
    look: 'Red handwheels mark the manual valves. The orange line is the well stream coming up the tubing and out of the wing valve.',
    typical: [
      ['Flowing wellhead pressure', '20 – 150 bar(g)'],
      ['Flowing temperature', '40 – 90 °C'],
      ['Downhole safety valve', 'fails closed'],
    ],
  },
  {
    id: 'manifold',
    n: 3,
    name: 'Production manifold',
    short: 'Manifold',
    system: 'wells',
    summary:
      'Gathers the flowlines from all wells into common headers, so the plant receives one combined stream.',
    how: [
      'Each well has a valve set that routes it either to the production header or to the test header.',
      'In the model, wells 1 and 2 go to production while well 3 is lined up to the test separator.',
      'Check valves stop one well from back-flowing into another.',
    ],
    look: 'Lower header: production (live flow). Upper header: test. The grey pipes have no flow at the moment.',
    typical: [
      ['Pressure', 'just above 1st-stage separator'],
      ['Wells per manifold', '4 – 20'],
    ],
  },
  {
    id: 'test-separator',
    n: 4,
    name: 'Test separator',
    short: 'Test sep.',
    system: 'wells',
    summary:
      'A smaller separator that measures one well at a time. Its oil, gas and water rates are used to allocate production to each well and to spot early changes in water cut or GOR.',
    how: [
      'One well is routed here for a test period while the others carry on to production.',
      'Separate meters on the gas, oil and water outlets give the individual phase rates.',
      'After metering, the streams rejoin the main process.',
    ],
    typical: [
      ['Test duration', '4 – 24 h per well'],
      ['Test frequency', '≈ monthly per well'],
    ],
  },
  {
    id: 'inlet-heater',
    n: 5,
    name: 'Inlet heater',
    short: 'Heater',
    system: 'wells',
    summary: 'Warms the incoming well stream before separation.',
    how: [
      'This is an indirect water-bath heater: a fire tube heats a bath of water, and the well fluid flows through a coil immersed in the bath, so the flame never touches the hydrocarbons.',
      'Higher temperature lowers oil viscosity, which helps water droplets settle and emulsions break.',
      'It also keeps the stream above the hydrate formation and wax appearance temperatures after the choke has cooled it.',
    ],
    look: 'Cutaway: the glowing fire tube sits low in the bath, with the process coil above it.',
    typical: [
      ['Outlet temperature', '40 – 70 °C'],
      ['Bath temperature', '≈ 80 – 90 °C'],
    ],
  },
  {
    id: 'hp-separator',
    n: 6,
    name: 'HP three-phase separator (1st stage)',
    short: 'HP separator',
    system: 'oil',
    summary:
      'The heart of the plant: a large horizontal vessel that uses gravity to split the well stream into gas, oil and water.',
    how: [
      'An inlet diverter absorbs the momentum of the incoming stream and makes the first bulk gas/liquid split.',
      'Liquid is held long enough for water (denser) to sink to the bottom while oil floats on top.',
      'Oil spills over a weir into the oil bucket. Level controllers draw off oil and water through separate outlets.',
      'Gas rises through a mist extractor that catches fine droplets and leaves at the top. A pressure controller on the gas outlet sets the vessel pressure.',
      'Pressure safety valves protect the vessel by relieving to the flare.',
    ],
    look: 'Cutaway: water (blue) under oil (brown), the weir plate, the oil bucket and the mist pad near the gas outlet. Dots show water droplets sinking and gas bubbles rising.',
    typical: [
      ['Pressure', '10 – 40 bar(g)'],
      ['Temperature', '40 – 70 °C'],
      ['Liquid residence time', '3 – 10 min'],
      ['Water in oil outlet', '≈ 2 – 10 %'],
    ],
  },
  {
    id: 'lp-separator',
    n: 7,
    name: 'LP separator (2nd stage)',
    short: 'LP separator',
    system: 'oil',
    summary:
      'Lowers the pressure again so more dissolved gas flashes out of the oil. Separating in stages maximises the amount of stable liquid recovered.',
    how: [
      'Oil from the HP separator is let down through a level control valve, and the pressure drop releases flash gas.',
      'It is a two-phase vessel: gas leaves at the top for the compressor and oil leaves at the bottom for the treater.',
      'Several smaller pressure steps keep more of the intermediate components (propane to hexane) in the oil than one big flash would.',
    ],
    typical: [
      ['Pressure', '2 – 7 bar(g)'],
      ['Liquid residence time', '2 – 5 min'],
    ],
  },
  {
    id: 'treater',
    n: 8,
    name: 'Electrostatic treater (dehydrator / desalter)',
    short: 'Treater',
    system: 'oil',
    summary:
      'Removes the last emulsified water and dissolved salt from the crude so it meets the export specification.',
    how: [
      'A high-voltage field between electrode grids polarises tiny water droplets, so they attract, collide and coalesce into large drops.',
      'Large drops settle much faster (by Stokes’ law, settling velocity ∝ diameter²) and drop into the water layer at the bottom.',
      'Heat and demulsifier chemicals weaken the oil film around the droplets.',
      'For desalting, fresh wash water is mixed in first to dilute the salty brine.',
    ],
    look: 'Cutaway: the glowing electrode grids sit in the oil, with water droplets falling out below them.',
    typical: [
      ['Grid voltage', '10 – 35 kV'],
      ['Temperature', '60 – 90 °C'],
      ['Product water (BS&W)', '≤ 0.5 vol %'],
      ['Product salt', '≤ ≈ 30 mg/L'],
    ],
  },
  {
    id: 'stabilizer',
    n: 9,
    name: 'Crude stabilizer',
    short: 'Stabilizer',
    system: 'oil',
    summary:
      'A distillation column that strips the lightest hydrocarbons (methane to butane) out of the crude, so it can be stored at atmospheric pressure and shipped without boiling off vapour.',
    how: [
      'Crude enters near the top and flows down across the trays.',
      'A reboiler at the bottom heats the crude. The vapour it makes rises through the trays and strips light ends from the falling liquid.',
      'Overhead vapour goes back to the gas compressor; stabilised crude leaves the bottom for storage.',
      'The specification is the Reid vapour pressure (RVP), measured at 37.8 °C.',
    ],
    look: 'Cutaway: the stacked trays inside the column. The reboiler is the small drum behind its base.',
    typical: [
      ['Pressure', '4 – 10 bar(g)'],
      ['Reboiler temperature', '120 – 200 °C'],
      ['RVP specification', '≤ ≈ 0.7 bar'],
    ],
  },
  {
    id: 'storage',
    n: 10,
    name: 'Crude storage tanks',
    short: 'Storage',
    system: 'oil',
    summary:
      'Large atmospheric tanks that act as a buffer between continuous production and export, and leave time for final settling and quality checks.',
    how: [
      'A floating roof rides on the oil surface, so there is almost no vapour space. This cuts evaporation losses and emissions.',
      'Tanks are gauged and sampled before the oil is exported.',
      'The bund wall around the tanks holds the oil if a tank fails (secondary containment).',
    ],
    typical: [
      ['Pressure', 'atmospheric'],
      ['Capacity', 'several days of production'],
      ['Diameter (real)', '20 – 80 m'],
    ],
  },
  {
    id: 'export',
    n: 11,
    name: 'Export pumps & fiscal metering',
    short: 'Oil export',
    system: 'oil',
    summary:
      'Pumps the on-spec crude into the export pipeline and measures it accurately. Ownership changes hands at this point (custody transfer).',
    how: [
      'Booster and main export pumps raise the oil to pipeline pressure.',
      'A metering skid with parallel meter runs (ultrasonic, turbine or Coriolis) is checked against a prover.',
      'An automatic sampler takes a flow-proportional sample for water content, density and composition.',
      'A pig launcher at the start of the pipeline sends cleaning and inspection "pigs" down the line.',
    ],
    typical: [
      ['Discharge pressure', '30 – 100 bar(g)'],
      ['Metering uncertainty', '≈ ±0.25 %'],
    ],
  },
  {
    id: 'scrubber',
    n: 12,
    name: 'Gas scrubber',
    short: 'Scrubber',
    system: 'gas',
    summary:
      'A vertical knock-out vessel that removes liquid droplets from the gas before it reaches the compressor.',
    how: [
      'The gas slows down inside the vessel, so larger droplets fall out by gravity.',
      'A wire-mesh mist eliminator (demister pad) near the top coalesces the fine droplets.',
      'Collected liquid drains back to the process. A high liquid level trips the compressor, because liquid slugs can destroy it.',
    ],
    look: 'Cutaway: the demister pad near the top and the collected liquid at the bottom.',
    typical: [
      ['Pressure', '≈ suction pressure'],
      ['Droplets removed', '≥ ≈ 10 µm'],
    ],
  },
  {
    id: 'compressor',
    n: 13,
    name: 'Gas compressor & aftercooler',
    short: 'Compressor',
    system: 'gas',
    summary:
      'Raises the gas pressure so it can be exported, used for gas lift, or re-injected. Flash gas from the low-pressure stages and the stabilizer overhead is recompressed here.',
    how: [
      'A centrifugal or reciprocating compressor is driven by an electric motor (blue) or a gas turbine.',
      'Compression heats the gas. An air-cooled "fin-fan" aftercooler (fans spinning on top) brings it back down.',
      'Anti-surge control recycles gas to keep a centrifugal compressor in its stable operating range.',
    ],
    typical: [
      ['Pressure ratio', '≈ 3 – 4 per stage'],
      ['Outlet after cooler', '40 – 50 °C'],
    ],
  },
  {
    id: 'dehydration',
    n: 14,
    name: 'Gas dehydration (TEG contactor)',
    short: 'TEG dehydration',
    system: 'gas',
    summary:
      'Removes water vapour from the gas to stop hydrates (ice-like solids) and corrosion in the export pipeline.',
    how: [
      'Wet gas enters at the bottom and rises through the trays.',
      'Lean triethylene glycol (TEG) flows down from the top and absorbs the water, flowing counter-current to the gas.',
      'Rich glycol goes to the regenerator (purple loop), where the water is boiled off at about 200 °C. The lean glycol is then pumped back to the top.',
    ],
    look: 'Cutaway: the purple trays are where gas and glycol meet. The regenerator skid sits behind the contactor.',
    typical: [
      ['Water content spec', '≈ 60 – 110 mg/Sm³'],
      ['Regenerator', '≈ 200 °C (TEG degrades above ≈ 205 °C)'],
    ],
  },
  {
    id: 'gas-export',
    n: 15,
    name: 'Sales-gas metering & export',
    short: 'Gas export',
    system: 'gas',
    summary:
      'Dry, compressed gas is measured and sent to the sales-gas pipeline. Part of it may be used as fuel gas or gas lift, or re-injected into the reservoir.',
    how: [
      'Ultrasonic meters measure the volume flow.',
      'A gas chromatograph (in the small shelter) analyses the composition to give density and heating value. Gas is sold by energy, not by volume.',
    ],
    typical: [
      ['Pressure', '50 – 100 bar(g)'],
      ['Metering uncertainty', '≈ ±0.7 – 1 %'],
    ],
  },
  {
    id: 'flare',
    n: 16,
    name: 'Flare system',
    short: 'Flare',
    system: 'utilities',
    summary:
      'The plant’s safe outlet to atmosphere. It collects and burns the gas released during upsets, start-ups and emergency depressurisation.',
    how: [
      'Pressure safety valves and blowdown valves on the vessels discharge into the flare header (red lines).',
      'A knock-out drum at the base removes liquid, so no burning liquid rains from the tip.',
      'Pilots that are always lit ignite the gas at the tip, and a small purge gas flow keeps air out of the header.',
      'Stack height and distance are chosen so heat radiation at ground level is safe for people.',
    ],
    typical: [
      ['Stack height (real)', '30 – 100 m'],
      ['Radiation, continuous exposure', '≈ 1.6 kW/m² (API 521)'],
    ],
  },
  {
    id: 'hydrocyclone',
    n: 17,
    name: 'Hydrocyclones (de-oiling)',
    short: 'Hydrocyclones',
    system: 'water',
    summary:
      'The first stage of produced-water treatment. It removes dispersed oil droplets from the water separated upstream.',
    how: [
      'Water enters the conical liners tangentially and spins at high speed, producing up to ≈ 1 000 g.',
      'Heavier water is thrown to the wall and leaves through the underflow. Lighter oil moves to a central core and leaves through the reject back to the process.',
      'There are no moving parts: the energy comes from the pressure drop.',
    ],
    look: 'Cutaway: the tapered liners inside the housing.',
    typical: [
      ['Inlet oil-in-water', '500 – 2 000 mg/L'],
      ['Outlet oil-in-water', '< ≈ 50 mg/L'],
    ],
  },
  {
    id: 'flotation',
    n: 18,
    name: 'Induced gas flotation (IGF)',
    short: 'Flotation',
    system: 'water',
    summary:
      'A polishing step: fine gas bubbles attach to the remaining oil droplets and float them to the surface, where the oily froth is skimmed off.',
    how: [
      'Rotors in several cells mix gas into the water as fine bubbles.',
      'Oil droplets stick to the bubbles and rise far faster than they would alone.',
      'The skimmed oil is recovered back into the process.',
    ],
    look: 'Cutaway: bubbles rise through the cells to the froth layer on top.',
    typical: [
      ['Outlet oil-in-water', '< 10 – 30 mg/L'],
      ['Residence time', '≈ 4 – 6 min'],
    ],
  },
  {
    id: 'injection',
    n: 19,
    name: 'Water injection pumps & injection well',
    short: 'Water injection',
    system: 'water',
    summary:
      'Cleaned produced water is pumped back into the reservoir. This disposes of the water and maintains reservoir pressure (pressure support).',
    how: [
      'High-pressure multistage centrifugal pumps raise the water to injection pressure.',
      'The water goes into the aquifer below the oil and pushes oil towards the producers (waterflood).',
      'Water quality (oil, solids, oxygen, bacteria) is controlled so the reservoir rock does not plug.',
    ],
    look: 'Follow the blue line down the injection well into the aquifer.',
    typical: [
      ['Discharge pressure', '100 – 250 bar(g)'],
      ['Voidage replacement', '≈ 1 (reservoir volumes)'],
    ],
  },
  {
    id: 'control-room',
    n: 20,
    name: 'Control room (DCS & ESD)',
    short: 'Control room',
    system: 'utilities',
    summary: 'Operators run the whole plant from here.',
    how: [
      'The distributed control system (DCS) runs the pressure, level, temperature and flow control loops and raises alarms.',
      'An independent safety instrumented system (emergency shutdown, ESD) closes valves and stops equipment if safe limits are exceeded.',
      'Fire and gas detectors around the plant can trigger shutdown and blowdown to the flare automatically.',
    ],
    typical: [
      ['Control loops', 'level & pressure on every vessel'],
      ['ESD', 'independent of the DCS'],
    ],
  },
];

export function equipmentById(id: EquipmentId): EquipmentInfo {
  const e = EQUIPMENT.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown equipment: ${id}`);
  return e;
}
