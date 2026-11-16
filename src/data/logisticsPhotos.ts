// Downloaded from the credited Unsplash pages; these photos illustrate logistics,
// and are not presented as TransLogix-owned facilities or vehicles.
const logisticsPhotos = [
  {
    id: "warehouse",
    src: `${import.meta.env.BASE_URL}images/logistics/warehouse.webp`,
    width: 1400,
    height: 1000,
    alt: "Organized warehouse aisles with shelves of boxed inventory",
    category: "Warehouse coordination",
    title: "Ready for the next handoff.",
    description: "From inventory confirmation to a prepared package.",
    photographer: "Russ Murray",
    source:
      "https://unsplash.com/photos/a-warehouse-is-filled-with-shelves-and-boxes-M7G_m5XJ-go",
  },
  {
    id: "parcels",
    src: `${import.meta.env.BASE_URL}images/logistics/parcels.webp`,
    width: 1400,
    height: 934,
    alt: "Cardboard parcels stacked inside a delivery van",
    category: "Order and package preparation",
    title: "Every package starts with an order.",
    description: "Keep customer details, items, and preparation connected.",
    photographer: "Claudio Schwarz",
    source:
      "https://unsplash.com/photos/cardboard-shipping-boxes-in-delivery-van-q8kR_ie6WnI",
  },
  {
    id: "transport",
    src: `${import.meta.env.BASE_URL}images/logistics/transport.webp`,
    width: 1400,
    height: 956,
    alt: "Two white freight trucks travelling along a highway",
    category: "Carrier coordination",
    title: "Keep the journey in view.",
    description:
      "Follow confirmation, dispatch, and delivery as distinct stages.",
    photographer: "Nishat Samadzai",
    source:
      "https://unsplash.com/photos/two-white-trucks-driving-on-a-highway-neCb34TcLEg",
  },
  {
    id: "port",
    src: `${import.meta.env.BASE_URL}images/logistics/port.webp`,
    width: 1400,
    height: 1050,
    alt: "Shipping containers and cargo handling equipment at the Port of Manila",
    category: "Connected logistics",
    title: "Different systems. One shared direction.",
    description: "Bring order, warehouse, and carrier information together.",
    photographer: "PortCalls Asia",
    source:
      "https://unsplash.com/photos/a-truck-is-parked-in-front-of-a-loading-dock-2vM-hJbDwME",
  },
] as const

export default logisticsPhotos
