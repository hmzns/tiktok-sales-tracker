import app from "./app";

const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "sales-tracker-api" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});