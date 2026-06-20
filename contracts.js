// SWR Platform — Shared contract config for browser frontends
// Loaded as a plain <script> tag; sets window.SWR

window.SWR = {
  chainId: 11155111, // Sepolia

  addresses: {
    KYCWhitelist:     '0xBB44656a76Bc785c0B959B9d448dbF9d83b16293',
    SWRToken:         '0xd9c626CF5a04375524a7ad815Ab6EA0CCC3F4D71',
    SARX:             '0xEf006D589A53a292771A78696FE79dCd9088B7f8',
    AssetToken:       '0x34E21ec5E04d801C468F76c83782FA5D6F0fb1D6',
    YieldDistributor: '0xD1495DBDB0b488c97279513593726e296D0555dD',
  },

  abis: {
    ERC20: [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
    ],
    KYCWhitelist: [
      'function isWhitelisted(address) view returns (bool)',
      'function getTier(address) view returns (uint8)',
    ],
    AssetToken: [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function tokenPriceSAR() view returns (uint256)',
    ],
    YieldDistributor: [
      'function pendingYield(address) view returns (uint256)',
      'function claim()',
      'function epochCount() view returns (uint256)',
      'function epochs(uint256) view returns (uint256, uint256, uint256, string)',
    ],
    AssetTokenFull: [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function tokenPriceSAR() view returns (uint256)',
      'function totalSupply() view returns (uint256)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function assetValueSAR() view returns (uint256)',
      'function assetId() view returns (string)',
      'function assetType() view returns (string)',
      'function shariahCertified() view returns (bool)',
    ],
  },

  // Tier enum: 0=None, 1=Retail, 2=Professional, 3=Institutional
  tierLabel: ['None', 'Retail', 'Professional', 'Institutional'],

  fmt: {
    // raw 6-decimal value → "1,234.56"
    sar6: (v) => (Number(v) / 1e6).toLocaleString('en-SA', { maximumFractionDigits: 2 }),
    // raw 18-decimal value → "1,234.56"
    tok18: (v) => (Number(ethers.utils.formatEther(v))).toLocaleString('en-SA', { maximumFractionDigits: 2 }),
    // shorten address
    addr: (a) => a.slice(0, 6) + '…' + a.slice(-4),
  },
};
