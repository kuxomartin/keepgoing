export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#20252B] max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-6 lg:py-10">
      {children}
    </div>
  )
}
