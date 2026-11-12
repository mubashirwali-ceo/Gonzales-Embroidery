/* ─────────────────────────────────────────────────────────────
   SEW-OUT GALLERY  —  this one file controls the Portfolio section.

   TO ADD NEW WORK
   1. Save the photo in  assets/sewouts/   (JPG, about 1200px on the long side is plenty)
   2. Add ONE line below (newest first works best):

      {cat:"digitizing", img:"my-photo.jpg", w:900, h:1200, title:"Customer — what you made"},

      cat   = "digitizing", "vector" or "patches"
      w, h  = photo width and height in pixels (optional, keeps the page from jumping while it loads)

   TO ADD A VIDEO  (YouTube link or an .mp4 you upload):
      {cat:"patches", type:"video", youtube:"VIDEO_ID", poster:"cover-photo.jpg", title:"Patch run"},
      {cat:"digitizing", type:"video", src:"assets/videos/clip.mp4", poster:"cover-photo.jpg", title:"Cap stitch-out"},

   Tip: keep .mp4 files small (under ~20 MB). For long videos, use YouTube.
   ───────────────────────────────────────────────────────────── */
window.SEWOUT_CATS = {
  digitizing: "Digitizing",
  vector: "Vector",
  patches: "Patches"
};

window.SEWOUTS = [
  /* ── Digitizing ── */
  {cat:"digitizing", img:"digi-hoodie-anime-eyes.jpg", w:960, h:1200, title:"Anime eyes — framed embroidery on a hoodie"},
  {cat:"digitizing", img:"digi-whoville-university.jpg", w:960, h:1200, title:"Whoville University — matching black sweatshirts"},
  {cat:"digitizing", img:"digi-hoodies-roman-date.jpg", w:960, h:1200, title:"Roman-numeral date & sleeve initials — matching couple hoodies"},
  {cat:"digitizing", img:"digi-spiderman-groot.jpg", w:1173, h:1200, title:"Spider-Man & Groot — custom character sweatshirts"},
  {cat:"digitizing", img:"digi-halloween-sin-ti.jpg", w:960, h:1200, title:"“Un Halloween sin ti” — crewneck back design"},
  {cat:"digitizing", img:"digi-caps-rochell-farms.jpg", w:720, h:960, title:"Rochell Farms — logo on trucker caps in 9 color combos"},
  {cat:"digitizing", img:"digi-outline-script-sweatshirts.jpg", w:960, h:1200, title:"Trojans, Lions & Cats — outline-script sweatshirts"},
  {cat:"digitizing", img:"digi-back-stolkin-temple.jpg", w:720, h:960, title:"Stolkin Temple — full shirt-back design"},
  {cat:"digitizing", img:"digi-back-suisun-city.jpg", w:1200, h:1200, title:"Oasis of Suisun City — detailed back design"},
  {cat:"digitizing", img:"digi-back-raspberry-beret.jpg", w:718, h:960, title:"Raspberry Beret — portrait & lettering back design"},
  {cat:"digitizing", img:"digi-cap-salem-surf.jpg", w:960, h:1200, title:"Salem Surf Club — stitching on the machine"},
  {cat:"digitizing", img:"digi-towel-lawson.jpg", w:900, h:1200, title:"Lawson — embroidered golf towel"},
  {cat:"digitizing", img:"digi-cap-warrior.jpg", w:1200, h:1200, title:"Ultimate Warrior — snapback"},
  {cat:"digitizing", img:"digi-hoodie-anime.jpg", w:900, h:1200, title:"Anime portrait — full-color sweatshirt"},
  {cat:"digitizing", img:"digi-jacket-lawrence-black.jpg", w:800, h:1200, title:"Lawrence Co. Classics Car Club — denim jacket"},
  {cat:"digitizing", img:"digi-mama-nightmares.jpg", w:1075, h:1200, title:"“This Mama Loves Her Little Nightmares” — custom names"},
  {cat:"digitizing", img:"digi-cap-shark.jpg", w:1200, h:900, title:"Fin & wave logo — flat-brim cap"},
  {cat:"digitizing", img:"digi-caps-usa-mama.jpg", w:900, h:1200, title:"MAMA & United States 1776 caps"},
  {cat:"digitizing", img:"digi-cap-wolves.jpg", w:960, h:1200, title:"Wolves — outlined lettering on a fitted cap"},
  {cat:"digitizing", img:"digi-fourth-grade.jpg", w:1024, h:1024, title:"“Fourth Grade” — teacher sweatshirt"},
  {cat:"digitizing", img:"digi-jacket-lawrence-red.jpg", w:900, h:1200, title:"Lawrence Co. Classics Car Club — red truck jacket"},
  {cat:"digitizing", img:"digi-cap-salty.jpg", w:900, h:1200, title:"“Salty” — multicolor script trucker cap"},
  {cat:"digitizing", img:"digi-cap-astros.jpg", w:1200, h:1200, title:"Blackletter lettering — close-up"},

  /* ── Vector ── */
  {cat:"vector", img:"vector-family-christmas.jpg", w:718, h:960, title:"“Ain’t No Family Like the One I Got” — Christmas tee"},
  {cat:"vector", img:"vector-bears-not-like-us.jpg", w:718, h:960, title:"“They Not Like Us” Bears — full-color tee"},
  {cat:"vector", img:"vector-grinch-zipper.jpg", w:718, h:960, title:"“Ew… People” — zipper Grinch tee"},
  {cat:"vector", img:"vector-pvamu-panthers.jpg", w:718, h:960, title:"PVAMU Panthers — full-color print"},
  {cat:"vector", img:"vector-eagles-1.jpg", w:1200, h:800, title:"Eagles Super Bowl — custom tee design 1"},
  {cat:"vector", img:"vector-eagles-2.jpg", w:1200, h:800, title:"Eagles Super Bowl — custom tee design 2"},
  {cat:"vector", img:"vector-eagles-3.jpg", w:1200, h:800, title:"Eagles Super Bowl — custom tee design 3"},
  {cat:"vector", img:"vector-athletics-game-day.jpg", w:1200, h:800, title:"Athletics Game Day — glitter-look bow tee"},
  {cat:"vector", img:"vector-oilers-homecoming.jpg", w:900, h:1200, title:"East Houston Oilers Homecoming — DTF print"},
  {cat:"vector", img:"vector-astros-set.jpg", w:1183, h:934, title:"Astros tee set"},
  {cat:"vector", img:"vector-cheer-aunt.jpg", w:900, h:1200, title:"Cheer Aunt — custom photo tee"},
  {cat:"vector", img:"vector-mama-fallvibes-tired.jpg", w:1200, h:1011, title:"Mama, Fall Vibes & Tired Moms Club"},
  {cat:"vector", img:"vector-oilers-cheer.jpg", w:900, h:1200, title:"E.H. Oilers Cheer"},
  {cat:"vector", img:"vector-oilers-football.jpg", w:900, h:1200, title:"East Houston Oilers Football"},
  {cat:"vector", img:"vector-kidzcan-budget.jpg", w:983, h:1200, title:"KidzCAN Budget — embroidered polo & printed tee"},
  {cat:"vector", img:"vector-cap-graffiti.jpg", w:900, h:1200, title:"Custom graffiti lettering — fitted cap"},

  /* ── Patches ── */
  {cat:"patches", type:"video", src:"assets/videos/patch-video-1.mp4", poster:"patch-video-1-poster.jpg", w:478, h:850, title:"Custom patches — rubber, PVC & embroidered"},
  {cat:"patches", type:"video", src:"assets/videos/patch-video-2.mp4", poster:"patch-video-2-poster.jpg", w:478, h:850, title:"Team & school patches — finished run"},
  {cat:"patches", type:"video", src:"assets/videos/patch-video-3.mp4", poster:"patch-video-3-poster.jpg", w:478, h:780, title:"Woven & embroidered patches — culture collection"},
  {cat:"patches", type:"video", src:"assets/videos/patch-video-4.mp4", poster:"patch-video-4-poster.jpg", w:360, h:640, title:"Hip-hop & music patches — close-up"},
  {cat:"patches", type:"video", src:"assets/videos/patch-video-5.mp4", poster:"patch-video-5-poster.jpg", w:478, h:850, title:"UPS Industrial Services — bulk patch order, packed"},
  {cat:"patches", img:"patch-gallera.jpg", w:1200, h:900, title:"Gallera Los Mochis — PVC patches"},
  {cat:"patches", img:"patch-pvc-skeleton.jpg", w:1200, h:1200, title:"Multi-layer PVC patch on a snapback"},
  {cat:"patches", img:"patches-collage.jpg", w:478, h:850, title:"Custom patch collection — woven & embroidered"},
  {cat:"patches", img:"patch-leather.jpg", w:840, h:840, title:"Laser-engraved leather patches"},
  {cat:"patches", img:"patch-plates.jpg", w:900, h:1200, title:"“Plates On My Mind” — embroidered patches"}
];
