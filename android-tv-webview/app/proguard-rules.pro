# ProGuard rules for AniMira TV

# Keep the entry points
-keep public class com.animira.tv.MainActivity {
    public <init>();
}

# Keep settings classes
-keep class com.animira.tv.SettingsActivity { *; }
-keep class com.animira.tv.SettingsManager { *; }

# WebView
-keepclassmembers class fqcn.of.javascript.interface.for.webview {
   public *;
}
