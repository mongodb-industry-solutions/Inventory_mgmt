import React, { useState, useEffect, useRef, useContext } from 'react';
import { clientPromise, edgeClientPromise } from '../../lib/mongodb';
import { useRouter } from 'next/router';
import { UserContext } from '../../context/UserContext';
import { ObjectId } from "bson";
import { ServerContext } from '../_app';
import ChartsEmbedSDK from '@mongodb-js/charts-embed-dom';
import { FaTshirt, FaWhmcs } from 'react-icons/fa';
import styles from '../../styles/product.module.css';
import Popup from '../../components/ReplenishmentPopup';
import StockLevelBar from '../../components/StockLevelBar';

export default function Product({ preloadedProduct }) {
    
    const [product, setProduct] = useState(preloadedProduct);
    const [showPopup, setShowPopup] = useState(false);
    const [imageError, setImageError] = useState(false);

    const router = useRouter();
    const { location, edge } = router.query;

    const utils = useContext(ServerContext);
    const {startWatchProductDetail, stopWatchProductDetail} = useContext(UserContext);

    const lightColors = [
        '#B1FF05','#E9FF99','#B45AF2','#F2C5EE',
        '#00D2FF','#A6FFEC', '#FFE212', '#FFEEA9', '#ffffff'
    ];

    const leafUrl = lightColors.includes(product.color?.hex) ? "/images/leaf_dark.png" : "/images/leaf_white.png";

    const productFilter = {'items.product.id': new ObjectId(preloadedProduct._id)};
    let locationFilter = {};
    //Add location filter if exists
    if (location) {
        locationFilter= { 'location.destination.id': new ObjectId(location)};
    }
    
    const sdk = new ChartsEmbedSDK({ baseUrl: utils.analyticsInfo.chartsBaseUrl});
    const dashboardDiv = useRef(null);
    const [rendered, setRendered] = useState(false);
    const [dashboard] = useState(sdk.createDashboard({ 
        dashboardId: utils.analyticsInfo.dashboardIdProduct, 
        filter: { $and: [productFilter, locationFilter]},
        widthMode: 'scale', 
        heightMode: 'scale', 
        background: '#fff'
    }));

    async function refreshProduct() {
        try {
          const response = await fetch(`/api/edge/getProducts?id=${preloadedProduct._id}`);

          if (response.status !== 304) { // 304 Not Modified
            const refreshedProduct = await response.json();
            setProduct(refreshedProduct.products[0]);
          }
        } catch (error) {
          console.error('Error refreshing data:', error);
        }
      };

    useEffect(() => {
        dashboard.render(dashboardDiv.current)
            .then(() => setRendered(true))
            .catch(err => console.log("Error during Charts rendering.", err));
      }, [dashboard]);

    useEffect(() => {
        if (edge !== 'true') {
          //initializeApp(utils.appServiceInfo.appId);
          startWatchProductDetail(setProduct,preloadedProduct, location, utils);
          return () => stopWatchProductDetail();
        } else {
            const interval = setInterval(refreshProduct, 5000);
            return () => clearInterval(interval);
        }
      }, [edge]);

    useEffect(() => {
        setProduct(preloadedProduct);
        if (rendered) {
            dashboard.setFilter({ $and: [productFilter, locationFilter]});
            dashboard.refresh();
        }
    }, [router.asPath]);

    const handleOpenPopup = () => {
        setShowPopup(true);
    };

    const handleClosePopup = () => {
        setShowPopup(false);
        dashboard.refresh();
    };

    const handleToggleAutoreplenishment = async () => {
        try {
              const response = await fetch(utils.apiInfo.dataUri + '/action/updateOne', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': 'Bearer ' + utils.apiInfo.accessToken,
                },
                body: JSON.stringify({
                  dataSource: 'mongodb-atlas',
                  database: utils.dbInfo.dbName,
                  collection: 'products',
                  filter: { "_id": { "$oid": preloadedProduct._id } },
                  update: {
                    "$set": { "autoreplenishment": !product.autoreplenishment }
                  }
                }),
              });
            if (response.ok) {
                console.log('Autoreplenishment toggled successfully');
            } else {
                console.log('Error toggling autoreplenishment');
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <>
        <div className="content">
        <div className={styles['product-detail-content']}>
            <div className={styles["image-container"]}>
            {
                imageError || !product.image?.url? 
                    (
                        utils.demoInfo.industry == 'manufacturing' ?
                            (
                                <FaWhmcs color="grey" className={styles["default-icon"]}/>
                            ) :
                            (
                                <>
                                    <FaTshirt color={product.color?.hex} className={styles["default-icon"]} />
                                    <img src={leafUrl} alt="Leaf" className={styles["leaf"]}/>
                                </>
                            )
                    ) :
                    (
                        <img 
                            src={product.image?.url} 
                            alt="Product Image" 
                            className={styles["product-image"]}
                            onError={() => setImageError(true)}
                        />
                    )
            }
            </div>
            <div className={styles["details"]}>
                <p className="name">{product.name}</p>
                <p className="price">{product.price?.amount} {product.price?.currency}</p>
                <p className="code">{product.code}</p>
                {<StockLevelBar stock={product.total_stock_sum} locationId={location} />}
                {location && (<div className={styles["switch-container"]}>
                    <span className={styles["switch-text"]}>Autoreplenishment</span>
                    <label className={styles["switch"]}>
                        <input type="checkbox" checked={product.autoreplenishment} onChange={handleToggleAutoreplenishment}/>
                        <span className={styles["slider"]}></span>
                    </label>
                </div>)}
            </div>
            <div className={styles["table"]}>
            <table>
                <thead>
                <tr>
                    <td>
                        { utils.demoInfo.industry == 'manufacturing' ? 
                                "Item" : 
                                "Size"
                        }
                    </td>
                    <td>
                        { utils.demoInfo.industry == 'manufacturing' ? 
                            "Factory" : 
                            "Store"
                        }
                    </td>
                    <td>Ordered</td>
                    <td>Warehouse</td>
                    <td>Delivery Time</td>
                    <td>Stock Level</td>
                </tr>
                </thead>
                <tbody>
                {product.items.map((item, index) => (
                    <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.stock.find(stock => stock.location.id === location)?.amount ?? 0}</td>
                    <td>{item.stock.find(stock => stock.location.id === location)?.ordered ?? 0}</td>
                    <td>{item.stock.find(stock => stock.location.type === 'warehouse')?.amount ?? 0}</td>
                    <td>{item.delivery_time.amount} {item.delivery_time.unit}</td>
                    <td>
                        {<StockLevelBar stock={item.stock} locationId={location}/>}
                    </td>
                    </tr>
                    ))}
                </tbody>
            </table>
            <div className={styles["legend"]}>
                <span className={`${styles["circle"]} ${styles["full"]}`}></span> <span>Full</span> &nbsp;&nbsp;
                <span className={`${styles["circle"]} ${styles["low"]}`}></span> <span>Low</span> &nbsp;&nbsp;
                <span className={`${styles["circle"]} ${styles["ordered"]}`}></span> <span>Ordered</span>
            </div>
            {location && (<button onClick={handleOpenPopup}>REPLENISH STOCK</button>)}
            </div>
        </div>
        <div className={styles["dashboard"]} ref={dashboardDiv}/>
        
        {showPopup && <Popup 
            product={product} 
            onClose={handleClosePopup} 
        />}
        </div>
        </>

    );
}

export async function getServerSideProps(context) {
    try {
        if (!process.env.MONGODB_DATABASE_NAME) {
            throw new Error('Invalid/Missing environment variables: "MONGODB_DATABASE_NAME"')
        }

        const dbName = process.env.MONGODB_DATABASE_NAME;

        const { params, query } = context;
        const locationId = query.location;
        const edge = (query.edge === 'true');

        const client = edge ? await edgeClientPromise : await clientPromise;
        const db = client.db(dbName);

        const collectionName = locationId ? "products" : "products_area_view";
       
        const product = await db
            .collection(collectionName)
            .findOne({ _id: new ObjectId(params._id)});

        return {
            props: { preloadedProduct: JSON.parse(JSON.stringify(product)) },
        };
    } catch (e) {
        console.error(e);
        return { props: {ok: false, reason: "Server error"}};
    }
}