const markSource = `${import.meta.env.BASE_URL}images/brand/trancelogix-mark.png`

export default function BrandMark() {
  return (
    <span
      className="brand-mark"
      aria-hidden="true"
      style={{
        maskImage: `url("${markSource}")`,
        WebkitMaskImage: `url("${markSource}")`,
      }}
    />
  )
}
