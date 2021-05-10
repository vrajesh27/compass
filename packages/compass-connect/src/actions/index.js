const Reflux = require('reflux');

const Actions = Reflux.createActions({
  hideFavoriteMessage: { sync: true },
  hideFavoriteModal: { sync: true },
  showFavoriteModal: { sync: true },
  validateConnectionString: { sync: true },
  onAuthSourceChanged: { sync: true },
  onAuthStrategyChanged: { sync: true },
  onCancelConnectionAttemptClicked: { sync: true },
  onChangeViewClicked: { sync: true },
  onCnameToggle: { sync: true },
  onConnectionFormChanged: { sync: true },
  onConnectionSelectAndConnect: { sync: true },
  onConnectClicked: { sync: true },
  onCreateFavoriteClicked: { sync: true },
  onCustomUrlChanged: { sync: true },
  onDeleteConnectionClicked: { sync: true },
  onDeleteConnectionsClicked: { sync: true },
  onDisconnectClicked: { sync: true },
  onDuplicateConnectionClicked: { sync: true },
  onEditURICanceled: { sync: true },
  onEditURIClicked: { sync: true },
  onEditURIConfirmed: { sync: true },
  onExternalLinkClicked: { sync: true },
  onFavoriteNameChanged: { sync: true },
  onConnectionSelected: { sync: true },
  onChangesDiscarded: { sync: true },
  onHideURIClicked: { sync: true },
  onHostnameChanged: { sync: true },
  onKerberosPrincipalChanged: { sync: true },
  onKerberosServiceNameChanged: { sync: true },
  onLDAPPasswordChanged: { sync: true },
  onLDAPUsernameChanged: { sync: true },
  onPasswordChanged: { sync: true },
  onPortChanged: { sync: true },
  onReadPreferenceChanged: { sync: true },
  onReplicaSetChanged: { sync: true },
  onResetConnectionClicked: { sync: true },
  onSaveAsFavoriteClicked: { sync: true },
  onSaveFavoriteClicked: { sync: true },
  onSSLCAChanged: { sync: true },
  onSSLCertificateChanged: { sync: true },
  onSSLMethodChanged: { sync: true },
  onSSLPrivateKeyChanged: { sync: true },
  onSSLPrivateKeyPasswordChanged: { sync: true },
  onSSHTunnelPasswordChanged: { sync: true },
  onSSHTunnelPassphraseChanged: { sync: true },
  onSSHTunnelHostnameChanged: { sync: true },
  onSSHTunnelUsernameChanged: { sync: true },
  onSSHTunnelPortChanged: { sync: true },
  onSSHTunnelIdentityFileChanged: { sync: true },
  onSSHTunnelChanged: { sync: true },
  onSRVRecordToggled: { sync: true },
  onUsernameChanged: { sync: true }
});

module.exports = Actions;