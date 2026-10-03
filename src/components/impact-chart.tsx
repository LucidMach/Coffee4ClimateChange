"use client";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
export default function ImpactChart({
  data,
}: {
  data: { day: string; kg: number }[];
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Completed transfers this week: ${data.map((d) => `${d.day} ${d.kg} kilograms`).join(", ")}`}
    >
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={30}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#76817c", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "#eef3ec" }}
            formatter={(v) => [`${v} kg`, "Confirmed transfer"]}
          />
          <Bar dataKey="kg" fill="#307660" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
