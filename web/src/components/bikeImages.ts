// Fixed, model-specific photos resolved from BikeWale model-page og:image data.
// External editorial/manufacturer assets, not owned or licensed by Moto Go.
// Check production usage rights before copying or redistributing these images.
const photo = (path: string) => `https://imgd.aeplcdn.com/1280x720/${path}`;

export const BIKE_IMAGES: Record<string, string> = {
  "bajaj-dominar-400": photo("bw/ec/39535/Bajaj-Dominar-400-2019-Side-154770.jpg?wm=2"),
  "bajaj-platina-110": photo("n/cw/ec/58391/platina-110-right-side-view-7.png?isig=0"),
  "bajaj-pulsar-n160": photo("n/cw/ec/124645/pulsar-n160-right-side-view-34.png?isig=0"),
  "hero-splendorplus": photo("n/cw/ec/212711/splendor-plus-right-side-view-3.png?isig=0"),
  "hero-xpulse-200-4v": photo("n/cw/ec/105184/xpulse-200-4v-right-side-view-11.png?isig=0"),
  "honda-cb350": photo("n/cw/ec/200501/cb350-right-side-view-9.png?isig=0"),
  "honda-shine-125": photo("n/cw/ec/45481/shine-right-side-view-17.png?isig=0"),
  "honda-sp-160": photo("n/cw/ec/154781/sp160-right-side-view-11.png?isig=0"),
  // Archived Jawa 42 page, not the newer All Stars 42 redirect:
  // https://www.bikewale.com/jawa-bikes/42-2024-2026/
  "jawa-42": photo("n/cw/ec/184473/42-right-side-view-2.png?isig=0"),
  "ktm-390-adventure": photo("n/cw/ec/220882/390-adventure-right-side-view-4.png?isig=0"),
  "ktm-duke-200": photo("n/cw/ec/129743/duke-200-right-side-view-6.jpeg?isig=0"),
  // Official Gen 3 article photo, not the newer 350cc or 390 Duke R banner.
  // https://www.ktmindia.com/blogs/ktm-390-duke-what-makes-the-gen-3s-a-class-apart-and-segment-leader
  "ktm-duke-390": "https://www.ktmindia.com/-/media/Images/ktm/Blogs/blog-2117/01.webp",
  "oben-rorr": photo("n/cw/ec/190769/rorr-right-side-view-2.png?isig=0"),
  "revolt-rv400": photo("n/cw/ec/40710/rv-400-right-side-view-12.png?isig=0"),
  "royal-enfield-classic-350": photo("n/cw/ec/101487/classic-350-right-side-view-20.png?isig=0"),
  "royal-enfield-himalayan-450": photo("n/cw/ec/110431/himalayan-right-side-view-8.png?isig=0"),
  "royal-enfield-interceptor-650": photo("n/cw/ec/49657/interceptor-right-side-view-16.png?isig=0"),
  "royal-enfield-meteor-350": photo("n/cw/ec/210213/meteor-350-right-side-view-9.png?isig=0"),
  // Official Royal Enfield Astral Black studio photo, matching the catalogue variant.
  "royal-enfield-super-meteor-650": "https://www.royalenfield.com/content/dam/royal-enfield/super-meteor-650/motorcycles/colors/studio-shots/astral-black/new/astral_black_000.webp",
  "tvs-apache-rr-310": photo("n/cw/ec/187327/apache-rr-310-right-side-view-10.png?isig=0"),
  "tvs-apache-rtr-160-4v": photo("n/cw/ec/97549/apache-rtr-160-4v-right-side-view-9.png?isig=0"),
  "tvs-raider-125": photo("n/cw/ec/103183/raider-125-right-side-view-12.png?isig=0"),
  "triumph-scrambler-400-x": photo("n/cw/ec/210613/scrambler-400-x-right-side-view.jpeg?isig=0"),
  "triumph-speed-400": photo("n/cw/ec/210611/speed-400-right-side-view-5.jpeg?isig=0"),
  "ultraviolette-f77": photo("n/cw/ec/171273/f77-left-front-three-quarter.png?isig=0"),
  "yamaha-r15-v4": photo("n/cw/ec/209893/r15-right-side-view-3.png?isig=0"),
  "yezdi-adventure": photo("n/cw/ec/201839/adventure-right-side-view-13.jpeg?isig=0"),
  // BikeDekho's exact BMW G 310 GS model-page hero photo:
  // https://www.bikedekho.com/bmw/g-310-gs
  "bmw-g-310-gs": "https://cdn.bikedekho.com/processedimages/bmw/g-310-gs/source/g-310-gs675006607e7fb.jpg",
};
