using System;
using Arise.FileSyncer.Common;
using Arise.FileSyncer.Core;
using Arise.FileSyncer.Service.Ipc;

namespace Arise.FileSyncer.Service
{
    internal class SyncerService : IDisposable
    {
        public NetworkDiscovery Discovery { get; private set; }
        public NetworkListener Listener { get; private set; }
        public SyncerConfig Config { get; private set; }
        public SyncerPeer Peer { get; private set; }
        public ProgressTracker ProgressTracker { get; private set; }

        private DiscoveryTimer discoveryTimer;
        private IpcController ipcController;
        private KeyConfig keyConfig;

        private bool isRunning = false;

        public void Run()
        {
            // Don't run the code if already running
            if (isRunning) return;

            // Load config
            Config = new SyncerConfig();
            LoadResult loadResult = Config.Load(CreatePeerSettings);
            if (loadResult != LoadResult.Loaded)
            {
                if (loadResult == LoadResult.Created) Log.Info("Created new config");
                if (Config.Save()) Log.Info("Saved config after create/upgrade");
                else Log.Error("Failed to save config after create/upgrade");
            }

            // Load key
            keyConfig = new KeyConfig();
            loadResult = keyConfig.Load();
            if (loadResult != LoadResult.Loaded)
            {
                if (loadResult == LoadResult.Created) Log.Info("Created new key");
                if (keyConfig.Save()) Log.Info("Saved key after create/upgrade");
                else Log.Error("Failed to save key after create/upgrade");
            }

            // Load syncing and connection handler classes
            Peer = new SyncerPeer(Config.PeerSettings);
            Listener = new NetworkListener(Config, keyConfig, Peer.AddConnection);
            Discovery = new NetworkDiscovery(Config, Peer, Listener);
            ProgressTracker = new ProgressTracker(Peer, 500);

            // Subscribe to save events
            Peer.NewPairAdded += (s, e) => Config.Save();
            Peer.ProfileAdded += (s, e) => Config.Save();
            Peer.ProfileRemoved += (s, e) => Config.Save();
            Peer.ProfileChanged += (s, e) => Config.Save();

            // Create a discovery periodic check
            discoveryTimer = new DiscoveryTimer(Discovery);

            try
            {
                // Create IPC server for UI app
                ipcController = new IpcController(this);
            }
            catch (Exception ex)
            {
                Log.Error("Failed to create IPC! Already running? Ex: " + ex.Message);
                throw;
            }

            // Write out a simple message
            Log.Info("Arise FileSyncer Started");
            isRunning = true;
        }

        public void Stop()
        {
            if (!isRunning) return;
            //TODO ?
            //isRunning = false;
        }

        private static SyncerPeerSettings CreatePeerSettings()
        {
            return new SyncerPeerSettings(Guid.NewGuid(), $"{Environment.MachineName}:{Environment.UserName}");
        }

        #region IDisposable Support
        private bool disposedValue = false;

        protected virtual void Dispose(bool disposing)
        {
            if (!disposedValue)
            {
                if (disposing)
                {
                    Stop();

                    ProgressTracker?.Dispose();
                    discoveryTimer?.Dispose();
                    ipcController?.Dispose();
                    Peer?.Dispose();
                    Listener?.Dispose();
                    Discovery?.Dispose();
                }

                disposedValue = true;
            }
        }

        public void Dispose()
        {
            Dispose(true);
        }
        #endregion
    }
}
