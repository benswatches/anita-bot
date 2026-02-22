import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Anita is up ✅");
});

app.post("/morning-sync", async (req, res) => {
  const { reminders, calendar } = req.body || {};

  res.json({
    ok: true,
    received: {
      reminders_preview: (reminders || "").slice(0, 200),
      calendar_preview: (calendar || "").slice(0, 200)
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Anita listening on ${port}`));
