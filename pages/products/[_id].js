import React, { useState, useEffect } from 'react';
import  *  as  Realm  from  "realm-web";
import clientPromise from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShirt } from '@fortawesome/free-solid-svg-icons';

import styles from '../../styles/product.module.css';
import Popup from '../../components/ReplenishmentPopup';
import StockLevelBar from '../../components/StockLevelBar';

const  app = new  Realm.App({ id:  "interns-mongo-retail-app-nghfn"});

export default function Product({ preloadedProduct }) {
    
    const [product, setProduct] = useState(preloadedProduct);
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        const  login = async () => {
        
            await app.logIn(Realm.Credentials.anonymous());
            const mongodb = app.currentUser.mongoClient("mongodb-atlas");
            const collection = mongodb.db("interns_mongo_retail").collection("products");

            for await (const  change  of  collection.watch({ $match: { 'fullDocument._id': preloadedProduct._id } })) {
                setProduct(change.fullDocument);
            }
        }
        login();
    }, []);

    const handleOpenPopup = () => {
        setShowPopup(true);
    };

    const handleClosePopup = () => {
        setShowPopup(false);
    };

    return (
        <>
        <div className={styles['product-detail-content']}>
            <div className={styles['icon']}>
                <FontAwesomeIcon id="tshirt" icon={faShirt} style={{ color: product.color.hex, fontSize: '10rem', backgroundColor: 'rgb(249, 251, 250)', padding: '15px'}}/>
            </div>
            <div className={styles["details"]}>
            <div className={styles["name-price-wrapper"]}>
                <p className="name">{product.name}</p>
                <p className="price">{product.price.amount} {product.price.currency}</p>
            </div>
                <p className="code">{product.code}</p>
                {<StockLevelBar stock={product.total_stock_sum} />}
            </div>
            <div className={styles["table"]}>
            <table>
                <thead>
                <tr>
                    <td>Size</td>
                    <td>Store</td>
                    <td>Ordered</td>
                    <td>Warehouse</td>
                    <td>Delivery Time</td>
                    <td>Stock Level</td>
                </tr>
                </thead>
                <tbody>
                {product.items.map((item, index) => (
                    <tr key={index}>
                    <td>{item.size}</td>
                    <td>{item.stock.find(stock => stock.location === 'store')?.amount ?? 0}</td>
                    <td>{item.stock.find(stock => stock.location === 'ordered')?.amount ?? 0}</td>
                    <td>{item.stock.find(stock => stock.location === 'warehouse')?.amount ?? 0}</td>
                    <td>{item.delivery_time.amount}</td>
                    <td>
                        {<StockLevelBar stock={item.stock} />}
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
            <button onClick={handleOpenPopup}>REPLENISH STOCK</button>
            </div>
        </div>
        {showPopup && <Popup product={product} onClose={handleClosePopup} />}
        </>

    );
}

export async function getServerSideProps(context) {
    try {
        const { req, params } = context;
        const client = await clientPromise;
        const db = client.db("interns_mongo_retail");

        const product = await db
            .collection("products")
            .findOne({ _id: ObjectId(params._id)});

        return {
            props: { preloadedProduct: JSON.parse(JSON.stringify(product)) },
        };
    } catch (e) {
        console.error(e);
        return { props: {ok: false, reason: "Server error"}};
    }
}