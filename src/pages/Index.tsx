import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import DynamicSections from "@/components/store/DynamicSections";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-[52px] lg:pt-[68px]">
        <DynamicSections />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
