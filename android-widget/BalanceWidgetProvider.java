package id.my.aurafinance;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Locale;

// Widget saldo AuraFi: membaca angka ringkas yang ditulis aplikasi lewat
// Capacitor Preferences (SharedPreferences "CapacitorStorage", kunci
// "aurafi_widget") lalu menampilkannya. Ketuk widget membuka aplikasi.
public class BalanceWidgetProvider extends AppWidgetProvider {

    private static String yen(long v) {
        return "¥" + NumberFormat.getNumberInstance(Locale.JAPAN).format(v);
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_balance);

        String kas = "—";
        String total = "—";
        String updated = "Buka AuraFi untuk sinkron";
        String pesan = "Tetap semangat mencatat!";
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String raw = prefs.getString("aurafi_widget", null);
            if (raw != null) {
                JSONObject o = new JSONObject(raw);
                kas = yen(o.optLong("kas", 0));
                total = yen(o.optLong("total", 0));
                String u = o.optString("updatedAt", "");
                if (!u.isEmpty()) updated = "Diperbarui " + u;
                String ps = o.optString("pesan", "");
                if (!ps.isEmpty()) pesan = ps;
            }
        } catch (Exception e) {
            // Biarkan nilai bawaan "—" tampil bila data belum ada/rusak.
        }

        views.setTextViewText(R.id.widget_kas, kas);
        views.setTextViewText(R.id.widget_total, total);
        views.setTextViewText(R.id.widget_pesan, pesan);
        views.setTextViewText(R.id.widget_updated, updated + " • ketuk untuk membuka AuraFi");

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pending = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        manager.updateAppWidget(widgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int id : widgetIds) {
            updateWidget(context, manager, id);
        }
    }
}
