import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import shirts from "../app/data/cloths.json";

export default function ShirtSection() {
  return (
    <section className="bg-gray-900 text-white py-12 px-6">
      <h3 className="text-3xl font-semibold mb-8 text-center text-orange-500">Featured Shirts</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {shirts.map((shirt) => (
          <Card key={shirt.id} className="bg-gray-800 border-none text-white hover:shadow-lg transition">
            <CardHeader>
              <img
                src={shirt.image || "https://via.placeholder.com/300x400?text=No+Image"}
                alt={shirt.name}
                className="w-full h-64 object-cover rounded-md"
              />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg font-semibold">{shirt.name}</CardTitle>
              <p className="text-orange-400 font-medium">{shirt.price}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
